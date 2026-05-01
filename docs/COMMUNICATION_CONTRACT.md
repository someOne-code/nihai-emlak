# Communication API Contract

This document is the canonical reference for the Phase 7 communication
backend. It describes how the Next.js communication routes behave, what
clients can rely on, and the security/data boundaries enforced behind
the API surface.

The API operates as a thin boundary on top of:
- Supabase user-context client (RLS + RPC)
- `chatwoot_conversations` table and its claim RPCs
- A Chatwoot HTTP client wrapper that holds the HMAC token server-side

No frontend is shipped in this phase; this contract is the API-side
contract clients (web/admin) MUST integrate against.

## Architecture Boundary

- Authoritative ownership and lifecycle state for a conversation lives
  in `public.chatwoot_conversations`.
- Chatwoot is the source of truth for raw message content; the API
  sanitizes its responses before exposing them.
- Authentication and authorization are enforced through Supabase auth
  plus RLS; no `service_role` is used in this layer.
- HMAC tokens for Chatwoot are loaded from environment and never sent
  to clients.

## Common Request Envelope

State-changing endpoints (`POST`) require:

- `Content-Type: application/json`
- `Origin` from the trusted origin set
- Authenticated Supabase session (user-context)
- JSON body within the size limit for that route

Failures fail closed before any DB or provider call:

- Wrong content-type: `415 Communication <route> requires application/json`
- Untrusted origin: `403 Communication <route> Origin is not trusted`
- Oversized body: `413 Communication <route> payload is too large`

## Common Response Envelope

All routes use a single response envelope:

```json
{ "success": true, "data": { "...": "..." } }
```

```json
{ "success": false, "error": "Human readable message" }
```

All responses set `Cache-Control: no-store`.

The `error` field is intentionally short and free of provider payload,
secrets, or internal stack traces. Provider failures are masked behind
a single canonical message:

```json
{ "success": false, "error": "Communication provider request failed" }
```

## Endpoints

### POST `/api/communications/listings/:listingId/conversation`

Claim or read the Chatwoot conversation mapping for the calling user
and the given listing.

**Request body**

```json
{ "initial_message": "optional 1..2000 char string" }
```

`initial_message` is optional. When omitted or empty after trim, no
initial message is sent to Chatwoot.

**Body limit:** 4 KB.

**Behavior**

- Calls `claim_chatwoot_conversation(p_listing_id)`.
- If the RPC returns `ready`, no provider call is made.
- If the RPC returns `claimed`, the route provisions Chatwoot
  contact + conversation (+ optional initial message) and then calls
  `complete_chatwoot_conversation_claim(...)`.
- If the RPC returns `in_progress`, the route does not contact
  Chatwoot and reports `409` to the client.
- If the RPC raises a unique-constraint duplicate (SQLSTATE `23505`),
  the route reports `409` (concurrent first-claim race).
- On any provider failure, the route calls
  `mark_chatwoot_conversation_claim_failed` and returns `502` with a
  sanitized error.

**Status codes**

| Status | Meaning                                                         |
|--------|-----------------------------------------------------------------|
| 200    | Existing ready mapping returned, no Chatwoot calls performed.    |
| 201    | New mapping provisioned and completed.                           |
| 400    | Invalid listing id, invalid body, or invalid initial message.    |
| 401    | Authentication required.                                         |
| 403    | Untrusted origin.                                                |
| 409    | Provisioning in progress for this user+listing.                  |
| 413    | Body exceeds 4 KB.                                               |
| 415    | Wrong Content-Type.                                              |
| 500    | Internal error parsing claim response or completing claim.       |
| 502    | Sanitized provider failure.                                      |

**Success response data**

```json
{
  "conversation_id": "<uuid>",
  "listing_id": "<uuid>",
  "chatwoot_conversation_id": "<provider id>",
  "status": "ready"
}
```

### GET `/api/communications/listings/:listingId/conversation`

Read the calling user's ready mapping for a listing.

**Behavior**

- No provider calls are made.
- Looks up `chatwoot_conversations` filtered by `user_id` and
  `listing_id`.
- Only mappings in status `ready` are returned. Provisioning, failed,
  or missing mappings yield `404`.

**Status codes**

| Status | Meaning                                                |
|--------|--------------------------------------------------------|
| 200    | Ready mapping exists for the caller and listing.       |
| 400    | Invalid listing id.                                    |
| 401    | Authentication required.                               |
| 404    | No ready mapping for this caller and listing.          |
| 500    | Mapping lookup failed.                                 |

**Success response data**

```json
{
  "conversation_id": "<uuid>",
  "listing_id": "<uuid>",
  "chatwoot_conversation_id": "<provider id>",
  "status": "ready"
}
```

### GET `/api/communications/conversations/:conversationId/messages`

List messages for a conversation owned by the caller.

**Ownership check**

- `chatwoot_conversations` is read with the user-context client and an
  explicit `user_id = auth.uid()` filter.
- Mappings not owned by the caller are reported as `404`, never `403`,
  to avoid leaking existence.
- Only `status = 'ready'` mappings are valid for message access.

**Sanitization rules**

- Only public chat messages are returned. Filtered out:
  - Any message with `private: true`
  - Any message whose Chatwoot `message_type` maps to anything other
    than `incoming` or `outgoing`
- Each returned message exposes only:
  - `id` (string), `content` (string), `message_type`
    (`"incoming" | "outgoing"`), `created_at` (number), `private`
    (boolean, always `false` for returned entries)
- Provider sender, account, attachments, and other raw fields are not
  forwarded.

**Status codes**

| Status | Meaning                                                |
|--------|--------------------------------------------------------|
| 200    | Sanitized message list returned.                       |
| 400    | Invalid conversation id.                               |
| 401    | Authentication required.                               |
| 404    | Mapping not owned by caller or not ready.              |
| 500    | Mapping lookup failed.                                 |
| 502    | Sanitized provider failure while listing messages.     |

**Success response data**

```json
{
  "conversation_id": "<uuid>",
  "messages": [
    {
      "id": "101",
      "content": "Merhaba",
      "message_type": "incoming",
      "created_at": 1714457200,
      "private": false
    }
  ]
}
```

### POST `/api/communications/conversations/:conversationId/messages`

Send an incoming message from the calling user into their conversation.

**Request body**

```json
{ "content": "1..2000 char string" }
```

`content` is trimmed; `length < 1` or `> 2000` is rejected.

**Body limit:** 8 KB.

**Behavior**

- Validates content-type, origin, and size before any auth or DB call.
- Validates UUID and content before contacting Chatwoot.
- Verifies ownership of the mapping using user-context Supabase client.
- Calls Chatwoot `createIncomingMessage` with `sourceId` and provider
  conversation id from the mapping; never trusts client-provided ids.
- Sanitizes the provider response. If the provider succeeds but the
  response cannot be sanitized into a valid message summary, the route
  fails closed with `502`.

**Status codes**

| Status | Meaning                                                |
|--------|--------------------------------------------------------|
| 201    | Message created and sanitized summary returned.        |
| 400    | Invalid conversation id or content.                    |
| 401    | Authentication required.                               |
| 403    | Untrusted origin.                                      |
| 404    | Mapping not owned by caller or not ready.              |
| 413    | Body exceeds 8 KB.                                     |
| 415    | Wrong Content-Type.                                    |
| 500    | Mapping lookup failed.                                 |
| 502    | Sanitized provider failure or unparseable response.    |

**Success response data**

```json
{
  "conversation_id": "<uuid>",
  "message": {
    "id": "555",
    "content": "Tesekkurler",
    "message_type": "incoming",
    "created_at": 1714457400,
    "private": false
  }
}
```

## Concurrency Contract

- The `(user_id, listing_id)` pair is unique on
  `public.chatwoot_conversations` via constraint
  `chatwoot_conversations_user_listing_key`.
- `claim_chatwoot_conversation` uses an `INSERT ... ON CONFLICT ON
  CONSTRAINT chatwoot_conversations_user_listing_key DO NOTHING`
  followed by a `SELECT ... FOR UPDATE` fallback. The first-claim race
  is resolved at the data layer; clients never see a generic 500 for
  this race.
- A duplicate first-claim attempt for the same caller+listing maps
  deterministically to `409 Conversation provisioning is already in
  progress`.
- Stale provisioning mappings (older than the RPC's reclaim window)
  are atomically reclaimed and reset by the RPC.

## Security Boundaries

- HMAC tokens for Chatwoot are loaded from environment and used only
  server-side. They are never returned to clients in success or error
  responses.
- Provider error bodies are never reflected to clients; the canonical
  error message is `Communication provider request failed`.
- All state-changing routes require trusted origin and JSON envelope
  validation before any auth, DB, or provider work.
- Ownership is enforced both via RLS on `chatwoot_conversations` and
  via explicit `user_id = auth.uid()` filters in the route layer
  (defense in depth).
- The route layer does not use `service_role`; only the user-context
  Supabase client.

## Known Limitations

- The messages GET endpoint does not yet expose pagination or cursor
  parameters. A follow-up phase will add a documented pagination
  contract; until then, the response reflects the provider default
  page.
- Streaming/realtime delivery is out of scope for Phase 7. Clients
  must poll the messages endpoint or rely on Chatwoot-side widgets
  outside this API surface.
- Activity, template, and private Chatwoot messages are intentionally
  hidden from the customer-facing API surface and are not retrievable
  via this contract.
