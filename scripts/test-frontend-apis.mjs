/**
 * Frontend API Comprehensive Test Script v2
 * Tests all public/frontend-facing API endpoints.
 * Origin header set for state-changing routes (required by the envelope validator).
 */

const BASE = "http://localhost:3000";
const ORIGIN = "http://localhost:3000";
const LISTING_ID = "9be36cd0-870a-4c01-adfc-52e03f9cffb8"; // Besiktas listing (active)
const FAKE_UUID = "00000000-0000-4000-8000-000000000000"; // valid UUID format, but non-existent

let pass = 0;
let fail = 0;
const results = [];

function record(name, ok, detail) {
  const status = ok ? "✅ PASS" : "❌ FAIL";
  results.push({ name, status, detail });
  if (ok) pass++; else fail++;
}

async function safeFetch(url, opts = {}) {
  try {
    const r = await fetch(url, { ...opts, redirect: "manual" });
    let body = null;
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("json")) {
      try { body = await r.json(); } catch { body = null; }
    }
    return { status: r.status, body, headers: r.headers, ok: r.ok };
  } catch (e) {
    return { status: 0, body: null, headers: null, ok: false, error: e.message };
  }
}

/** Helper for POST with Origin header */
function postJson(url, body) {
  return safeFetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "origin": ORIGIN },
    body: JSON.stringify(body),
  });
}

// ═══════════════════════════════════════════════════════════════
// 1. GET /api/public/listings — List active listings
// ═══════════════════════════════════════════════════════════════
async function testPublicListings() {
  // 1a. Happy path — no filters
  const r1 = await safeFetch(`${BASE}/api/public/listings`);
  const items1 = r1.body?.data?.items;
  record(
    "GET /api/public/listings (no filters)",
    r1.status === 200 && r1.body?.success === true && Array.isArray(items1),
    `status=${r1.status} items=${items1?.length ?? "?"}`
  );

  // 1b. Filter by type=rent
  const r2 = await safeFetch(`${BASE}/api/public/listings?type=rent`);
  const items2 = r2.body?.data?.items;
  const allRent = Array.isArray(items2) && items2.every(i => i.type === "rent");
  record(
    "GET /api/public/listings?type=rent",
    r2.status === 200 && r2.body?.success && allRent,
    `status=${r2.status} items=${items2?.length ?? "?"} allRent=${allRent}`
  );

  // 1c. Filter by type=sale
  const r3 = await safeFetch(`${BASE}/api/public/listings?type=sale`);
  const items3 = r3.body?.data?.items;
  const allSale = Array.isArray(items3) && items3.every(i => i.type === "sale");
  record(
    "GET /api/public/listings?type=sale",
    r3.status === 200 && r3.body?.success && allSale,
    `status=${r3.status} items=${items3?.length ?? "?"} allSale=${allSale}`
  );

  // 1d. Filter by city
  const r4 = await safeFetch(`${BASE}/api/public/listings?city=Istanbul`);
  record(
    "GET /api/public/listings?city=Istanbul",
    r4.status === 200 && r4.body?.success,
    `status=${r4.status} items=${r4.body?.data?.items?.length ?? "?"}`
  );

  // 1e. Pagination
  const r5 = await safeFetch(`${BASE}/api/public/listings?limit=2&offset=0`);
  const items5 = r5.body?.data?.items;
  record(
    "GET /api/public/listings?limit=2&offset=0",
    r5.status === 200 && r5.body?.success && Array.isArray(items5) && items5.length <= 2,
    `status=${r5.status} items=${items5?.length ?? "?"}`
  );

  // 1f. Offset pagination (skip first 2)
  const r5b = await safeFetch(`${BASE}/api/public/listings?limit=2&offset=2`);
  const items5b = r5b.body?.data?.items;
  record(
    "GET /api/public/listings?limit=2&offset=2 (pagination offset)",
    r5b.status === 200 && r5b.body?.success && Array.isArray(items5b),
    `status=${r5b.status} items=${items5b?.length ?? "?"}`
  );

  // 1g. Response includes pagination metadata
  record(
    "List response includes limit/offset metadata",
    r1.body?.data?.limit !== undefined && r1.body?.data?.offset !== undefined,
    `limit=${r1.body?.data?.limit} offset=${r1.body?.data?.offset}`
  );

  // 1h. Invalid type
  const r6 = await safeFetch(`${BASE}/api/public/listings?type=invalid`);
  record(
    "GET /api/public/listings?type=invalid → 400",
    r6.status === 400 && r6.body?.success === false,
    `status=${r6.status} error=${r6.body?.error}`
  );

  // 1i. Invalid limit (non-numeric)
  const r7 = await safeFetch(`${BASE}/api/public/listings?limit=abc`);
  record(
    "GET /api/public/listings?limit=abc → 400",
    r7.status === 400 && r7.body?.success === false,
    `status=${r7.status} error=${r7.body?.error}`
  );

  // 1j. Limit too high
  const r8 = await safeFetch(`${BASE}/api/public/listings?limit=999`);
  record(
    "GET /api/public/listings?limit=999 → 400",
    r8.status === 400 && r8.body?.success === false,
    `status=${r8.status} error=${r8.body?.error}`
  );

  // 1k. Negative offset
  const r9 = await safeFetch(`${BASE}/api/public/listings?offset=-1`);
  record(
    "GET /api/public/listings?offset=-1 → 400",
    r9.status === 400 && r9.body?.success === false,
    `status=${r9.status} error=${r9.body?.error}`
  );
}

// ═══════════════════════════════════════════════════════════════
// 2. GET /api/public/listings/:id — Listing detail
// ═══════════════════════════════════════════════════════════════
async function testPublicListingDetail() {
  // 2a. Happy path
  const r1 = await safeFetch(`${BASE}/api/public/listings/${LISTING_ID}`);
  const d = r1.body?.data;
  record(
    "GET /api/public/listings/:id (valid active)",
    r1.status === 200 && r1.body?.success && d?.title && d?.status === "active",
    `status=${r1.status} title=${d?.title} type=${d?.type}`
  );

  // 2b. Response shape — all required fields
  const hasFields = d && d.id && d.title && d.type && d.city && d.price !== undefined && d.description;
  record(
    "Listing detail has required fields (id, title, type, city, price, description)",
    !!hasFields,
    `id=${!!d?.id} title=${!!d?.title} type=${!!d?.type} city=${!!d?.city} price=${d?.price !== undefined} desc=${!!d?.description}`
  );

  // 2c. Images array
  record(
    "Listing detail includes images array",
    Array.isArray(d?.images) && d.images.length > 0,
    `images=${d?.images?.length ?? 0}`
  );

  // 2d. Image items have url
  const firstImage = d?.images?.[0];
  record(
    "Image item has url field",
    firstImage && typeof firstImage.url === "string",
    `url=${firstImage?.url?.substring(0, 60) ?? "missing"}`
  );

  // 2e. Invalid UUID
  const r2 = await safeFetch(`${BASE}/api/public/listings/not-a-uuid`);
  record(
    "GET /api/public/listings/not-a-uuid → 400",
    r2.status === 400 && r2.body?.success === false,
    `status=${r2.status} error=${r2.body?.error}`
  );

  // 2f. Non-existent UUID → 404
  const r3 = await safeFetch(`${BASE}/api/public/listings/${FAKE_UUID}`);
  record(
    "GET /api/public/listings/:nonExistent → 404",
    r3.status === 404 && r3.body?.success === false,
    `status=${r3.status} error=${r3.body?.error}`
  );
}

// ═══════════════════════════════════════════════════════════════
// 3. GET /api/public/listings/:id/services — Listing services
// ═══════════════════════════════════════════════════════════════
async function testPublicListingServices() {
  // 3a. Happy path
  const r1 = await safeFetch(`${BASE}/api/public/listings/${LISTING_ID}/services`);
  record(
    "GET /api/public/listings/:id/services → 200",
    r1.status === 200 && r1.body?.success === true,
    `status=${r1.status} data_keys=${JSON.stringify(Object.keys(r1.body?.data ?? {}))}`
  );

  // 3b. Invalid UUID
  const r2 = await safeFetch(`${BASE}/api/public/listings/bad-uuid/services`);
  record(
    "GET /api/public/listings/bad-uuid/services → 400",
    r2.status === 400 && r2.body?.success === false,
    `status=${r2.status} error=${r2.body?.error}`
  );

  // 3c. Non-existent UUID
  const r3 = await safeFetch(`${BASE}/api/public/listings/${FAKE_UUID}/services`);
  record(
    "GET /api/public/listings/:nonExistent/services → 200 or 404",
    (r3.status === 200 || r3.status === 404) && r3.body?.success !== undefined,
    `status=${r3.status}`
  );
}

// ═══════════════════════════════════════════════════════════════
// 4. POST /api/sale-leads — Create sale lead (auth required)
// ═══════════════════════════════════════════════════════════════
async function testSaleLeads() {
  // 4a. No auth, valid Origin → 401
  const r1 = await postJson(`${BASE}/api/sale-leads`, {
    listing_id: LISTING_ID,
    contact_name: "Test User",
    message: "Bu ilan hakkında bilgi almak istiyorum",
  });
  record(
    "POST /api/sale-leads (no auth, valid origin) → 401",
    r1.status === 401 && r1.body?.success === false,
    `status=${r1.status} error=${r1.body?.error}`
  );

  // 4b. Missing Origin → 403
  const r2 = await safeFetch(`${BASE}/api/sale-leads`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ listing_id: LISTING_ID, contact_name: "Test", message: "Hello there" }),
  });
  record(
    "POST /api/sale-leads (no Origin header) → 403",
    r2.status === 403 && r2.body?.success === false && r2.body?.error?.includes("Origin"),
    `status=${r2.status} error=${r2.body?.error}`
  );

  // 4c. Invalid content-type → 415
  const r3 = await safeFetch(`${BASE}/api/sale-leads`, {
    method: "POST",
    headers: { "content-type": "text/plain", "origin": ORIGIN },
    body: "hello",
  });
  record(
    "POST /api/sale-leads (text/plain) → 415",
    r3.status === 415 && r3.body?.success === false,
    `status=${r3.status} error=${r3.body?.error}`
  );

  // 4d. GET not allowed → 405
  const r4 = await safeFetch(`${BASE}/api/sale-leads`, { method: "GET" });
  record(
    "GET /api/sale-leads → 405",
    r4.status === 405,
    `status=${r4.status}`
  );
}

// ═══════════════════════════════════════════════════════════════
// 5. POST /api/checkout — Create checkout (auth required)
// ═══════════════════════════════════════════════════════════════
async function testCheckout() {
  // 5a. No auth → 401
  const r1 = await postJson(`${BASE}/api/checkout`, {
    listing_id: LISTING_ID,
    move_in_date: "2026-07-01",
    stay_months: 6,
  });
  record(
    "POST /api/checkout (no auth) → 401",
    r1.status === 401 && r1.body?.success === false,
    `status=${r1.status} error=${r1.body?.error}`
  );

  // 5b. Invalid content-type → 415
  const r2 = await safeFetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "content-type": "text/plain", "origin": ORIGIN },
    body: "hello",
  });
  record(
    "POST /api/checkout (text/plain) → 415",
    r2.status === 415 && r2.body?.success === false,
    `status=${r2.status} error=${r2.body?.error}`
  );

  // 5c. GET not allowed → 405
  const r3 = await safeFetch(`${BASE}/api/checkout`, { method: "GET" });
  record(
    "GET /api/checkout → 405",
    r3.status === 405,
    `status=${r3.status}`
  );

  // 5d. Missing Origin → 403
  const r4 = await safeFetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  record(
    "POST /api/checkout (no Origin) → 403",
    r4.status === 403 && r4.body?.error?.includes("Origin"),
    `status=${r4.status} error=${r4.body?.error}`
  );
}

// ═══════════════════════════════════════════════════════════════
// 6. POST /api/checkout/init — Initialize checkout (auth required)
// ═══════════════════════════════════════════════════════════════
async function testCheckoutInit() {
  // 6a. No auth → 401
  const r1 = await postJson(`${BASE}/api/checkout/init`, {
    order_id: FAKE_UUID,
  });
  record(
    "POST /api/checkout/init (no auth) → 401",
    r1.status === 401 && r1.body?.success === false,
    `status=${r1.status} error=${r1.body?.error}`
  );

  // 6b. Invalid content-type → 415
  const r2 = await safeFetch(`${BASE}/api/checkout/init`, {
    method: "POST",
    headers: { "content-type": "text/plain", "origin": ORIGIN },
    body: "hello",
  });
  record(
    "POST /api/checkout/init (text/plain) → 415",
    r2.status === 415 && r2.body?.success === false,
    `status=${r2.status} error=${r2.body?.error}`
  );

  // 6c. Missing Origin → 403
  const r3 = await safeFetch(`${BASE}/api/checkout/init`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  record(
    "POST /api/checkout/init (no Origin) → 403",
    r3.status === 403 && r3.body?.error?.includes("Origin"),
    `status=${r3.status} error=${r3.body?.error}`
  );
}

// ═══════════════════════════════════════════════════════════════
// 7. POST /api/payment/callback — Payment callback
// ═══════════════════════════════════════════════════════════════
async function testPaymentCallback() {
  // 7a. Invalid content-type → 415
  const r1 = await safeFetch(`${BASE}/api/payment/callback`, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "hello",
  });
  record(
    "POST /api/payment/callback (text/plain) → 415",
    r1.status === 415 && r1.body?.success === false,
    `status=${r1.status} error=${r1.body?.error}`
  );

  // 7b. Missing fields → 400 (requires ISBANK_STORE_KEY configured)
  const r2 = await safeFetch(`${BASE}/api/payment/callback`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "foo=bar",
  });
  record(
    "POST /api/payment/callback (missing fields) → 400 or 500",
    (r2.status === 400 || r2.status === 500) && r2.body?.success === false,
    `status=${r2.status} error=${r2.body?.error}`
  );

  // 7c. GET not allowed → 405
  const r3 = await safeFetch(`${BASE}/api/payment/callback`, { method: "GET" });
  record(
    "GET /api/payment/callback → 405",
    r3.status === 405,
    `status=${r3.status}`
  );

  // 7d. JSON content-type with proper fields but invalid hash
  const r4 = await safeFetch(`${BASE}/api/payment/callback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      oid: FAKE_UUID,
      mdStatus: "1",
      Response: "Approved",
      ProcReturnCode: "00",
      HASH: "x".repeat(40),
      HASHPARAMS: "oid:mdStatus:Response:ProcReturnCode",
      HASHPARAMSVAL: `${FAKE_UUID}1Approved00`,
      clientid: "test",
    }),
  });
  record(
    "POST /api/payment/callback (invalid hash) → 400/401/500",
    (r4.status === 400 || r4.status === 401 || r4.status === 500) && r4.body?.success === false,
    `status=${r4.status} error=${r4.body?.error}`
  );
}

// ═══════════════════════════════════════════════════════════════
// 8. Communications — Conversation endpoints
// ═══════════════════════════════════════════════════════════════
async function testCommunications() {
  // 8a. POST conversation (no auth, valid origin) → 401
  const r1 = await postJson(`${BASE}/api/communications/listings/${LISTING_ID}/conversation`, {
    initial_message: "Merhaba",
  });
  record(
    "POST /api/comms/listings/:id/conversation (no auth) → 401",
    r1.status === 401 && r1.body?.success === false,
    `status=${r1.status} error=${r1.body?.error}`
  );

  // 8b. GET conversation (no auth) → 401
  const r2 = await safeFetch(`${BASE}/api/communications/listings/${LISTING_ID}/conversation`);
  record(
    "GET /api/comms/listings/:id/conversation (no auth) → 401",
    r2.status === 401 && r2.body?.success === false,
    `status=${r2.status} error=${r2.body?.error}`
  );

  // 8c. GET messages (no auth) → 401
  const r3 = await safeFetch(`${BASE}/api/communications/conversations/${FAKE_UUID}/messages`);
  record(
    "GET /api/comms/conversations/:id/messages (no auth) → 401",
    r3.status === 401 && r3.body?.success === false,
    `status=${r3.status} error=${r3.body?.error}`
  );

  // 8d. POST message (no auth, valid origin) → 401
  const r4 = await postJson(`${BASE}/api/communications/conversations/${FAKE_UUID}/messages`, {
    content: "Test message",
  });
  record(
    "POST /api/comms/conversations/:id/messages (no auth) → 401",
    r4.status === 401 && r4.body?.success === false,
    `status=${r4.status} error=${r4.body?.error}`
  );

  // 8e. Invalid listing ID → 400
  const r5 = await postJson(`${BASE}/api/communications/listings/not-uuid/conversation`, {});
  record(
    "POST /api/comms/listings/not-uuid/conversation → 400",
    r5.status === 400 && r5.body?.success === false,
    `status=${r5.status} error=${r5.body?.error}`
  );

  // 8f. Missing Origin on POST → 403
  const r6 = await safeFetch(`${BASE}/api/communications/listings/${LISTING_ID}/conversation`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  record(
    "POST /api/comms/listings/:id/conversation (no Origin) → 403",
    r6.status === 403 && r6.body?.error?.includes("Origin"),
    `status=${r6.status} error=${r6.body?.error}`
  );
}

// ═══════════════════════════════════════════════════════════════
// 9. Auth confirm
// ═══════════════════════════════════════════════════════════════
async function testAuthConfirm() {
  // 9a. No params → redirect to error
  const r1 = await safeFetch(`${BASE}/auth/confirm`);
  record(
    "GET /auth/confirm (no params) → redirect",
    [302, 303, 307].includes(r1.status),
    `status=${r1.status} location=${r1.headers?.get("location")?.substring(0, 80)}`
  );

  // 9b. Invalid token → redirect to error
  const r2 = await safeFetch(`${BASE}/auth/confirm?token_hash=abc&type=signup`);
  record(
    "GET /auth/confirm?token_hash=abc → redirect to error",
    [302, 303, 307].includes(r2.status) && (r2.headers?.get("location") ?? "").includes("error"),
    `status=${r2.status} location=${r2.headers?.get("location")?.substring(0, 80)}`
  );

  // 9c. Open redirect protection — absolute URL in next
  const r3 = await safeFetch(`${BASE}/auth/confirm?token_hash=abc&type=signup&next=https://evil.com`);
  const loc3 = r3.headers?.get("location") ?? "";
  record(
    "GET /auth/confirm?next=https://evil.com → does NOT redirect to evil.com",
    !loc3.includes("evil.com"),
    `location=${loc3.substring(0, 80)}`
  );

  // 9d. Open redirect protection — protocol-relative
  const r4 = await safeFetch(`${BASE}/auth/confirm?token_hash=abc&type=signup&next=//evil.com`);
  const loc4 = r4.headers?.get("location") ?? "";
  record(
    "GET /auth/confirm?next=//evil.com → does NOT redirect externally",
    !loc4.includes("evil.com"),
    `location=${loc4.substring(0, 80)}`
  );
}

// ═══════════════════════════════════════════════════════════════
// 10. Response envelope & security contract
// ═══════════════════════════════════════════════════════════════
async function testResponseContract() {
  // 10a. cache-control: no-store
  const r1 = await safeFetch(`${BASE}/api/public/listings`);
  record(
    "Response has cache-control: no-store",
    r1.headers?.get("cache-control")?.includes("no-store"),
    `cache-control=${r1.headers?.get("cache-control")}`
  );

  // 10b. Success envelope {success, data}
  record(
    "Success response has {success:true, data:...}",
    r1.body?.success === true && r1.body?.data !== undefined,
    `keys=${Object.keys(r1.body || {}).join(",")}`
  );

  // 10c. Error envelope {success, error}
  const r2 = await safeFetch(`${BASE}/api/public/listings?type=xxx`);
  record(
    "Error response has {success:false, error:string}",
    r2.body?.success === false && typeof r2.body?.error === "string",
    `keys=${Object.keys(r2.body || {}).join(",")}`
  );

  // 10d. No content-type on POST → 415
  const r3 = await safeFetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "origin": ORIGIN },
    body: "test",
  });
  record(
    "POST without content-type → 415",
    r3.status === 415,
    `status=${r3.status}`
  );

  // 10e. Untrusted Origin → 403
  const r4 = await safeFetch(`${BASE}/api/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json", "origin": "https://evil.com" },
    body: JSON.stringify({}),
  });
  record(
    "POST with untrusted Origin → 403",
    r4.status === 403 && r4.body?.error?.includes("not trusted"),
    `status=${r4.status} error=${r4.body?.error}`
  );
}

// ═══════════════════════════════════════════════════════════════
// RUN ALL
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log(" Frontend API Comprehensive Test Suite v2");
  console.log("═══════════════════════════════════════════════════════\n");

  await testPublicListings();
  await testPublicListingDetail();
  await testPublicListingServices();
  await testSaleLeads();
  await testCheckout();
  await testCheckoutInit();
  await testPaymentCallback();
  await testCommunications();
  await testAuthConfirm();
  await testResponseContract();

  console.log("\n═══════════════════════════════════════════════════════");
  console.log(" RESULTS");
  console.log("═══════════════════════════════════════════════════════\n");

  for (const r of results) {
    console.log(`${r.status} ${r.name}`);
    if (r.status.includes("FAIL")) console.log(`   → ${r.detail}`);
  }

  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(` TOTAL: ${pass + fail} tests | ✅ ${pass} passed | ❌ ${fail} failed`);
  console.log(`═══════════════════════════════════════════════════════`);

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(2);
});
