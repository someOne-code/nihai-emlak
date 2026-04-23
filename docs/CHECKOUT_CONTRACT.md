# Checkout Backend Contract

## Scope

This document defines the Phase 3 checkout backend contract for the frontend and admin/content teams.

The checkout flow is intentionally split into two steps:

1. `POST /api/checkout` creates the operational checkout records.
2. `POST /api/checkout/init` creates the Is Bankasi hosted checkout payload for an existing pending order/payment.

`POST /api/checkout` does not return an Is Bankasi payload. `POST /api/checkout/init` does not create reservations, orders, order items, or payments.

## Architecture Contract

- Supabase Auth is the identity/session source.
- The Next.js routes are thin state-changing request boundaries.
- PostgreSQL/RPC is the authoritative source for checkout eligibility, pricing, atomic record creation, and write invariants.
- The frontend never sends trusted totals.
- `service_role` is not the default checkout create model.
- Listing availability and item pricing are read from database/admin configuration at request time.

## Frontend Flow

```text
User selects listing + main payment items + optional services
  -> POST /api/checkout
  -> receive reservation/order/payment summary
  -> POST /api/checkout/init with orderId
  -> receive Is Bankasi hosted checkout payload
  -> submit/render bank hosted payment form
```

If `POST /api/checkout` fails, the frontend must not call `POST /api/checkout/init`.

If `POST /api/checkout/init` returns `409`, the frontend must not retry by inventing a new payment. The user should refresh the checkout state or restart the checkout create step.

## Shared Request Requirements

Both checkout routes are state-changing cookie-auth endpoints.

Required:

- Authenticated Supabase session.
- `Content-Type: application/json`.
- Trusted `Origin` header.
- JSON body within the route body-size limit.

Responses are JSON and should be treated as non-cacheable.

Common error shape:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

## POST /api/checkout

Creates a pending reservation, pending order, order items, and pending Is Bankasi payment.

### Request

```http
POST /api/checkout
Content-Type: application/json
```

```json
{
  "listing_id": "11111111-1111-4111-8111-111111111111",
  "move_in_date": "2026-05-15",
  "stay_months": 3,
  "guest_count": 2,
  "main_items": ["deposit"],
  "service_items": ["cleaning"],
  "note": "Optional customer note"
}
```

### Request Fields

| Field | Required | Notes |
| --- | --- | --- |
| `listing_id` | yes | UUID. Normalized server-side. |
| `move_in_date` | yes | ISO date, `YYYY-MM-DD`. Past dates are rejected by the DB function. |
| `stay_months` | yes | Integer from 1 to 12. |
| `guest_count` | yes | Positive integer. |
| `main_items` | yes | Array of item codes. Must contain at least one item. No duplicates. |
| `service_items` | no | Array of service codes. Defaults to empty when omitted. No duplicates. |
| `note` | no | String or null. Blank notes are normalized to null. |

Item codes must be lowercase-compatible normalized codes:

```text
^[a-z0-9][a-z0-9_-]*$
```

The parser trims and lowercases item codes before passing them to the DB/RPC layer.

### Forbidden Client Fields

The frontend must not send financial totals. These fields are rejected:

- `amount`
- `currency`
- `price`
- `total`
- `total_amount`

The authoritative total is calculated by PostgreSQL from listing, main item, service, override, stay-month, and admin configuration data.

### Success Response

Status: `201 Created`

```json
{
  "success": true,
  "data": {
    "reservation": {
      "id": "22222222-2222-4222-8222-222222222222"
    },
    "order": {
      "id": "33333333-3333-4333-8333-333333333333",
      "totalAmount": 1250,
      "currency": "TRY"
    },
    "payment": {
      "id": "44444444-4444-4444-8444-444444444444",
      "status": "pending"
    },
    "listing": {
      "id": "11111111-1111-4111-8111-111111111111"
    }
  }
}
```

Important response rules:

- The response does not include an `isbank` payload.
- `payment.status` is always `pending` on success.
- `payment.id` is the Is Bankasi `oid`/`provider_ref` source for the next step.

### Error Responses

| Status | Meaning |
| --- | --- |
| `400` | Invalid request body, invalid item selection, forbidden client total, malformed date/count/item code. |
| `401` | Missing or invalid authenticated session. |
| `403` | Missing/untrusted origin. |
| `409` | Listing unavailable, sale listing, inactive listing, no enabled main items, existing pending checkout for listing, or stale checkout state. |
| `413` | Request body too large. |
| `415` | Content type is not JSON. |
| `500` | Server/RPC/configuration failure. Treat as non-retryable until backend health is confirmed. |

## POST /api/checkout/init

Creates the Is Bankasi hosted checkout payload for an existing pending order/payment.

This endpoint must only be called after `POST /api/checkout` succeeds.

### Request

```http
POST /api/checkout/init
Content-Type: application/json
```

```json
{
  "orderId": "33333333-3333-4333-8333-333333333333"
}
```

### Request Fields

| Field | Required | Notes |
| --- | --- | --- |
| `orderId` | yes | UUID returned from `POST /api/checkout`. |

### Success Response

Status: `200 OK`

```json
{
  "success": true,
  "data": {
    "isbank": {
      "HASH": "BANK_HASH",
      "amount": "1250.00",
      "clientid": "ISBANK_CLIENT_ID",
      "currency": "TRY",
      "failurl": "https://example.com/checkout/fail",
      "instalment": "0",
      "oid": "44444444-4444-4444-8444-444444444444",
      "okurl": "https://example.com/checkout/success",
      "rnd": "RANDOM_VALUE",
      "txnType": "Auth"
    },
    "payment": {
      "amount": 1250,
      "currency": "TRY",
      "id": "44444444-4444-4444-8444-444444444444",
      "orderId": "33333333-3333-4333-8333-333333333333",
      "providerRef": "44444444-4444-4444-8444-444444444444",
      "status": "pending"
    }
  }
}
```

Important response rules:

- `data.payment.id`, `data.payment.providerRef`, and `data.isbank.oid` must be the same UUID.
- The endpoint reuses an existing pending payment.
- The endpoint does not create missing pending payments.
- The endpoint does not rewrite stale, terminal, or amount-drifted payments.

### Error Responses

| Status | Meaning |
| --- | --- |
| `400` | Invalid request body or invalid `orderId`. |
| `401` | Missing or invalid authenticated session. |
| `403` | Missing/untrusted origin. |
| `404` | Order not found for the authenticated user. |
| `409` | Order is not pending, payment is missing, payment is terminal, or payment no longer matches the order total. |
| `413` | Request body too large. |
| `415` | Content type is not JSON. |
| `500` | Server/payment configuration failure. |

## Pricing Rules

The frontend can display a price preview, but it must not be treated as authoritative.

Authoritative pricing rules:

- `orders.total_amount` is generated by PostgreSQL/RPC.
- `order_items.amount` rows are generated by PostgreSQL/RPC.
- The order total must match the sum of generated line items.
- Default currency is `TRY` unless the DB configuration says otherwise.
- Listing base price, main item configuration, service catalog prices, listing-level overrides, and stay-month rules are DB/admin configuration.
- Negative, missing, malformed, or ambiguous pricing configuration must fail closed.

## Main Items and Services

Main payment items are selected by the customer in the frontend, but the selectable set is controlled by admin/DB configuration.

Admin/DB source of truth:

- `main_item_catalog`
- `listing_main_item_options`
- `service_catalog`
- `listing_service_options`

Frontend responsibilities:

- Send selected main item codes in `main_items`.
- Send selected optional service codes in `service_items`.
- Do not send labels, prices, totals, or currency.
- Do not offer services unless at least one main item is selected.

Backend responsibilities:

- Reject unknown, inactive, or listing-disabled main items.
- Reject unknown, inactive, or listing-disabled services.
- Apply listing-specific price overrides when configured.
- Reject sale listings and unavailable rental listings for checkout.
- Prevent multiple concurrent pending checkout attempts for the same listing.

## Admin/Content Team Notes

Admin-managed item codes must stay compatible with the checkout parser and DB checks.

Valid examples:

- `deposit`
- `first_rent`
- `cleaning`
- `insurance_q1`

Invalid examples:

- `First Rent`
- `deposit.v2`
- ` cleaning `
- ``

Display labels can be Turkish or English and are not part of the API contract. The API contract uses stable item codes only.

## Non-Goals

This contract does not define:

- Frontend UI layout.
- Admin UI implementation.
- Bank callback completion behavior.
- Refund or void flows.
- Long-running notification/CRM workflows.

Payment callback completion remains the payment callback/DB function responsibility.

