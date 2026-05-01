# Phase 7 Communication Layer Subphase Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Summary

Phase 7, authenticated kullanıcılar için Chatwoot tabanlı ilan konuşma backend kontratını parçalara bölerek ilerleyecek. Ana veri Supabase’de kalacak; Chatwoot yalnızca contact/conversation/message tarafını yönetecek. Public widget veya custom chat UI bu fazda yok.

## Phase 7.1: Communication Data Contract

Status: implemented.

- Supabase migration ile `chatwoot_conversations` mapping tablosu eklenir.
- Unique contract: `user_id + listing_id`.
- Alanlar:
  - `id`
  - `user_id`
  - `listing_id`
  - `chatwoot_source_id`
  - `chatwoot_conversation_id`
  - `status`: `provisioning | ready | failed`
  - `failure_reason`
  - `created_at`, `updated_at`
- RLS:
  - kullanıcı sadece kendi mapping kayıtlarını okuyabilir.
  - admin tüm mapping kayıtlarını okuyabilir.
  - authenticated kullanıcı doğrudan insert/update/delete yapamaz.
- DB/RPC:
  - `claim_chatwoot_conversation(p_listing_id)`
  - `complete_chatwoot_conversation_claim(...)`
  - `mark_chatwoot_conversation_claim_failed(...)`
- Test:
  - aynı user + aynı listing tek kayıt üretir.
  - farklı user aynı listing için ayrı kayıt alır.
  - fresh `provisioning` duplicate açmayı engeller.
  - stale `provisioning` ve `failed` reclaim edilebilir.
  - inactive/missing listing reddedilir.
  - RLS ownership/admin sınırı korunur.

## Phase 7.2: Chatwoot Identity + Client Helpers

Status: implemented.

- Server-side Chatwoot helper eklenir.
- Required env:
  - `CHATWOOT_BASE_URL`
  - `CHATWOOT_INBOX_IDENTIFIER`
  - `CHATWOOT_HMAC_TOKEN`
- Contact identifier:
  - `user:${supabaseUserId}`
- HMAC:
  - SHA-256 HMAC, `CHATWOOT_HMAC_TOKEN` ile server-side üretilir.
  - frontend token üretmez.
- Chatwoot client:
  - contact create/get-or-create payload üretir.
  - conversation create payload üretir.
  - message create/list çağrılarını sarar.
  - raw provider response/error dışarı sızdırmaz.
- Test:
  - HMAC deterministik üretilir.
  - env eksikse fail-closed.
  - contact/conversation/message URL ve payload’ları doğru kurulur.
  - HMAC secret response payload’a sızmaz.

## Phase 7.3: Conversation Open Route

- Route:
  - `POST /api/communications/listings/:listingId/conversation`
- Auth:
  - Supabase auth zorunlu.
  - JSON content-type ve trusted origin guard kullanılır.
- Request body:
  - `{ "initial_message"?: string }`
  - `initial_message` varsa trim edilir, `1..2000` karakter.
- Behavior:
  - mevcut ready mapping varsa Chatwoot’a yeni conversation açmadan aynı mapping döner.
  - mapping yoksa DB claim alınır.
  - Chatwoot contact oluşturulur.
  - Chatwoot conversation oluşturulur.
  - `initial_message` varsa Chatwoot incoming message olarak gönderilir.
  - DB mapping `ready` yapılır.
  - Chatwoot hatasında mapping `failed` yapılır ve 502 döner.
- Response:
  - `conversation_id`
  - `listing_id`
  - `chatwoot_conversation_id`
  - `status`
- Test:
  - unauthenticated 401.
  - invalid UUID 400.
  - non-json 415.
  - untrusted origin 403.
  - oversized body 413.
  - existing mapping Chatwoot network call yapmaz.
  - new mapping Chatwoot call order’ı doğru.
  - provider failure raw payload sızdırmadan 502 döner.

## Phase 7.4: Conversation Read + Messages Routes

- Routes:
  - `GET /api/communications/listings/:listingId/conversation`
  - `GET /api/communications/conversations/:conversationId/messages`
  - `POST /api/communications/conversations/:conversationId/messages`
- Behavior:
  - listing conversation GET yalnızca current user’ın ready mapping’ini döner.
  - messages GET local mapping ownership doğrular, sonra Chatwoot messages list çağrısı yapar.
  - messages POST ownership doğrular, `content` trim eder, incoming Chatwoot message oluşturur.
- Message request:
  - `{ "content": string }`
  - `1..2000` karakter.
- Test:
  - kullanıcı başkasının conversation mesajlarını okuyamaz/gönderemez.
  - missing mapping 404.
  - invalid message content 400.
  - Chatwoot list/send hatası 502, raw provider payload yok.
  - successful response sanitize edilmiş message summary döner.

## Phase 7.5: Contract Docs + Phase Closure

- `docs/COMMUNICATION_CONTRACT.md` eklenir.
- İçerik:
  - env vars.
  - route contract’ları.
  - DB/RPC contract’ları.
  - Chatwoot setup: API inbox, inbox identifier, HMAC identity validation.
  - out-of-scope notları.
- `docs/IMPLEMENTATION_PLAN.md` Phase 7 kapanışı eklenir.
- Final validation:
  - `node --experimental-strip-types --test tests/phase7-chatwoot-client.test.mts tests/phase7-communication-route.test.mts`
  - `npm run test:db-security`
  - `npm test`

## Assumptions

- Phase 7 v1 sadece backend contract’tır.
- Sadece authenticated Supabase kullanıcıları konuşma başlatabilir.
- Anonymous lead chat, widget, custom chat UI, realtime subscription, attachments, labels, assignment rules ve WhatsApp out of scope.
- Chatwoot message body source-of-truth Chatwoot’tur.
- Supabase source-of-truth yalnızca user/listing/conversation mapping ve authorization’dır.
