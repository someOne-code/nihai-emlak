# Admin Listing Config Contract

> **Status:** Phase 8 closure contract. Endpoint paths, request/response
> shapes, and DB/RPC names are pinned for the Phase 8 admin listing
> implementation.

This document is the canonical reference for the Phase 8 admin listing,
image, main item, and service pricing configuration backend. It
describes how the admin Next.js routes behave, what DB/RPC contracts
they call, and the security/data boundaries enforced behind the API.

The API operates as a thin boundary on top of:

- Supabase user-context client (RLS + RPC + `public.is_admin()` checks)
- `public.listings`, `public.listing_images`, `public.listing_main_item_options`,
  and `public.listing_service_options` tables and their admin RPCs
- Existing public read models, which MUST stay unchanged in their
  authorization and shape

No frontend redesign is shipped in this phase; this contract is the
API-side contract the admin UI (`/admin/listings`) integrates against.

## Architecture Boundary

- Authoritative ownership and lifecycle state for a listing lives in
  `public.listings`, with image and option config in their dedicated
  tables.
- Payload CMS is NOT the operational source of truth; it remains the
  content/blog backend.
- Authentication and authorization are enforced through Supabase auth
  plus RLS plus `public.is_admin()`; no `service_role` is used in this
  layer.
- Sensitive lifecycle decisions (price floor, slug uniqueness, status
  transitions, sale/rent eligibility) are enforced at the DB/RPC layer.
  The route layer only validates request envelope and maps DB errors to
  HTTP responses.

## Common Request Envelope

State-changing endpoints require:

- `Content-Type: application/json` for `POST` and `PATCH` with bodies
- `Origin` from the trusted origin set
- Authenticated Supabase session with admin (`public.is_admin()` true)
- JSON body within the size limit (8 KB default for admin listing
  routes)

Failures fail closed before any DB or provider call:

- Wrong content-type for `POST`/`PATCH`: `415 Admin <route> requires application/json`
- Untrusted origin: `403 Admin <route> Origin is not trusted`
- Oversized body: `413 Admin <route> payload is too large`
- Missing or non-admin auth: `401` for missing session, `403` for
  authenticated non-admin

## Common Response Envelope

All admin listing routes use a single envelope:

```json
{ "success": true, "data": { "...": "..." } }
```

```json
{ "success": false, "error": "Human readable message" }
```

All responses set `Cache-Control: no-store`.

The `error` field is intentionally short and free of database payload,
secrets, or stack traces. DB violations are mapped to canonical error
strings.

## Endpoint Catalog

The following endpoints are reserved for Phase 8. Each sub-phase
implements one row.

| Sub-phase | Method | Path                                                      | Purpose                              |
|-----------|--------|-----------------------------------------------------------|--------------------------------------|
| 8.1       | GET    | `/api/admin/listings`                                     | Admin listing list                   |
| 8.1       | GET    | `/api/admin/listings/:listingId`                          | Admin listing snapshot               |
| 8.2       | POST   | `/api/admin/listings`                                     | Create listing                       |
| 8.2       | PATCH  | `/api/admin/listings/:listingId`                          | Update listing or change status      |
| 8.3       | POST   | `/api/admin/listings/:listingId/images`                   | Add listing image record             |
| 8.3       | PATCH  | `/api/admin/listings/:listingId/images/order`             | Reorder listing images               |
| 8.3       | DELETE | `/api/admin/listings/:listingId/images/:imageId`          | Delete listing image record          |
| 8.4       | PATCH  | `/api/admin/listings/:listingId/main-items/:code`         | Configure main item option           |
| 8.4       | PATCH  | `/api/admin/listings/:listingId/services/:code`           | Configure service option             |

The matching DB/RPC contract names reserved for Phase 8 are:

- `admin_list_listings()` (read)
- `admin_get_listing(p_listing_id)` (read snapshot)
- `admin_create_listing(...)` (8.2)
- `admin_update_listing(p_listing_id, ...)` (8.2)
- `admin_set_listing_status(p_listing_id, p_status)` (8.2)
- `admin_add_listing_image(...)` (8.3)
- `admin_reorder_listing_images(p_listing_id, p_order)` (8.3)
- `admin_delete_listing_image(p_listing_id, p_image_id)` (8.3)
- `admin_configure_listing_main_item(p_listing_id, p_code, ...)` (8.4)
- `admin_configure_listing_service(p_listing_id, p_code, ...)` (8.4)

## Status Code Map

| Status | Meaning                                                                  |
|--------|--------------------------------------------------------------------------|
| 200    | Read or update succeeded.                                                |
| 201    | Create succeeded.                                                        |
| 204    | Delete succeeded; no body.                                               |
| 400    | Invalid uuid, body shape, enum, price, slug, or sort/order request.       |
| 401    | Authentication required.                                                  |
| 403    | Authenticated non-admin or untrusted origin.                              |
| 404    | Target listing/image/option not found for caller scope.                   |
| 409    | Duplicate slug, duplicate option code, or invalid status transition.      |
| 413    | Body exceeds the admin route limit.                                       |
| 415    | Wrong Content-Type for state-changing request.                            |
| 422    | DB-level validation failure (e.g. rent listing missing checkout config).  |
| 500    | Mapping/lookup or RPC infrastructure failure.                             |

## Validation Rules

- `price` (when applicable) MUST be a non-negative integer in minor
  units; negative values are rejected at both the route and DB layers.
- `status` MUST be one of the listing status enum values; any other
  value is rejected as `400`.
- Listing `slug` is unique across active listings; duplicates yield
  `409`.
- `sort_order` for images and main item options MUST be a non-negative integer.
- `override_amount` and `override_multiplier` for option config MUST
  be non-negative when provided.

## Sale vs Rent Rules

- A `rent` listing MAY be activated only when its checkout-relevant
  config is complete (at minimum: at least one enabled main item and
  the required service options the public checkout contract expects).
  Activation without that config yields `422` with the canonical
  message `Rent listing is not checkout-ready`.
- A `sale` listing MAY be created, updated, and activated without any
  checkout/main-item/service configuration.
- Status transitions are enforced at the DB layer; the route layer
  reports the DB error verbatim from the canonical mapping table, not
  the raw Postgres message.

## Image Config Rules

- A listing MAY have at most one primary image at any time. Adding a
  second primary atomically demotes the previous primary.
- `sort_order` MUST be deterministic across reorder operations; the
  reorder RPC accepts the full ordered list of image ids and rewrites
  `sort_order` atomically.
- Image add accepts only absolute `http:` and `https:` URLs. Empty,
  relative, malformed, `javascript:`, and non-HTTP(S) URLs return `400`.
- Image DELETE requires a trusted `Origin` but does not require a JSON
  content type or request body.
- Public read models MUST NOT expose admin-only image fields
  (e.g. `is_disabled`, internal notes) added later in Phase 8.

## Main Item and Service Option Rules

- Each `(listing_id, normalized_code)` pair is unique per option type.
- Disabled options MUST be excluded from public read models and from
  checkout quote/create.
- Override values, when provided, replace the catalog default for that
  listing only; absent overrides fall back to the catalog default.
- PATCH requests support partial update semantics. If `is_enabled` is
  omitted for an existing option, the current enabled state is
  preserved. If a new main item or service option is attached without
  `is_enabled`, the DB default behavior creates it enabled.
- The admin UI still sends `{ "is_enabled": true }` when attaching a
  new catalog main item or service.
- Negative override amounts/multipliers are rejected.
- Service option `sort_order` is out of scope for Phase 8. No service
  sort field is exposed in the RPC snapshot, route payload, or admin UI.
- `admin_get_listing` includes `available_main_items` and
  `available_services` arrays for catalog add controls. These arrays
  contain active catalog rows only and omit private/internal fields.

## Security Boundaries

- The route layer never uses `service_role`; it always uses the
  authenticated user-context Supabase client.
- Admin checks happen at the DB/RPC layer through `public.is_admin()`;
  the route layer only enforces session presence, not permission.
- Origin and content-type guards run before any auth or DB call.
- Public read models are not modified by Phase 8; admin reads use
  separate RPCs/views and do not widen any public surface.

## UI Behavior

- `/admin/listings` is an operational admin surface, not the operational
  source of truth.
- The admin UI may show catalog picker controls for main items and services,
  but the authoritative write path remains the existing admin routes and
  DB/RPC contracts.
- Main item attach flow uses active rows returned in `available_main_items`
  and calls `admin_configure_listing_main_item` through the existing route
  with `{ "is_enabled": true }`.
- Service attach flow uses active rows returned in `available_services` and
  calls `admin_configure_listing_service` through the existing route with
  `{ "is_enabled": true }`.
- The UI must distinguish global catalog creation from listing attachment:
  Phase 8 only attaches existing catalog rows to a listing.
- Checkout readiness must be presented from DB/RPC snapshot data; the UI must
  not invent eligibility decisions.
- Phase 8 is not complete until browser smoke proves that an admin can attach
  one main item and one service from the catalog and see both reflected in the
  listing snapshot.

## Out of Scope

- Listing image binary upload and storage; Phase 8 manages
  `image_url` records only.
- Public frontend redesign; only the admin surface
  (`/admin/listings`) is in scope.
- Bulk import/export of listings or pricing.
- Global main item and service catalog management; Phase 8 attaches existing
  catalog rows to listings.
- Audit log surface; existing audit/event tables, if any, continue to
  capture writes, but admin-facing audit views are out of scope.
