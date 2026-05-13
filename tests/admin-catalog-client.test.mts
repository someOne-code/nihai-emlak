import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchAdminCatalogMainItems,
  fetchAdminCatalogServices,
  createAdminCatalogMainItem,
  updateAdminCatalogMainItem,
  createAdminCatalogService,
  updateAdminCatalogService,
  AdminCatalogClientError,
  type AdminCatalogFetch,
} from "../lib/admin-ui/catalog-client.ts";

// ---------------------------------------------------------------------------
// GET catalog helpers
// ---------------------------------------------------------------------------

test("catalog client: fetchAdminCatalogMainItems hits /api/admin/catalog/main-items", async () => {
  const calls: string[] = [];
  const fetcher: AdminCatalogFetch = async (input) => {
    calls.push(String(input));
    return new Response(JSON.stringify({ success: true, data: [] }), {
      headers: { "content-type": "application/json" },
    });
  };

  await fetchAdminCatalogMainItems({ fetcher });

  assert.equal(calls.length, 1);
  assert.equal(calls[0], "/api/admin/catalog/main-items");
});

test("catalog client: fetchAdminCatalogServices hits /api/admin/catalog/services", async () => {
  const calls: string[] = [];
  const fetcher: AdminCatalogFetch = async (input) => {
    calls.push(String(input));
    return new Response(JSON.stringify({ success: true, data: [] }), {
      headers: { "content-type": "application/json" },
    });
  };

  await fetchAdminCatalogServices({ fetcher });

  assert.equal(calls.length, 1);
  assert.equal(calls[0], "/api/admin/catalog/services");
});

// ---------------------------------------------------------------------------
// GET uses same-origin credentials + no-store
// ---------------------------------------------------------------------------

test("catalog client: GET requests use same-origin credentials and no-store", async () => {
  const inits: RequestInit[] = [];
  const fetcher: AdminCatalogFetch = async (_input, init) => {
    inits.push(init ?? {});
    return new Response(JSON.stringify({ success: true, data: [] }), {
      headers: { "content-type": "application/json" },
    });
  };

  await fetchAdminCatalogMainItems({ fetcher });

  assert.equal(inits[0].credentials, "same-origin");
  assert.equal(inits[0].cache, "no-store");
});

// ---------------------------------------------------------------------------
// POST / PATCH
// ---------------------------------------------------------------------------

test("catalog client: createAdminCatalogMainItem sends JSON POST to /api/admin/catalog/main-items", async () => {
  const calls: { input: string; init: RequestInit }[] = [];
  const fetcher: AdminCatalogFetch = async (input, init) => {
    calls.push({ input: String(input), init: init ?? {} });
    return new Response(JSON.stringify({ success: true, data: { id: "1" } }), {
      headers: { "content-type": "application/json" },
    });
  };

  await createAdminCatalogMainItem(
    { code: "kira", label: "Kira", pricing_strategy: "fixed", default_amount: 12000 },
    { fetcher },
  );

  assert.equal(calls[0].input, "/api/admin/catalog/main-items");
  assert.equal(calls[0].init.method, "POST");
  assert.equal((calls[0].init.headers as Record<string, string>)["content-type"], "application/json");
  assert.equal(calls[0].init.credentials, "same-origin");
});

test("catalog client: updateAdminCatalogMainItem sends JSON PATCH to /api/admin/catalog/main-items/:code", async () => {
  const calls: { input: string; init: RequestInit }[] = [];
  const fetcher: AdminCatalogFetch = async (input, init) => {
    calls.push({ input: String(input), init: init ?? {} });
    return new Response(JSON.stringify({ success: true, data: { id: "1" } }), {
      headers: { "content-type": "application/json" },
    });
  };

  await updateAdminCatalogMainItem("kira", { is_active: false }, { fetcher });

  assert.equal(calls[0].input, "/api/admin/catalog/main-items/kira");
  assert.equal(calls[0].init.method, "PATCH");
});

test("catalog client: createAdminCatalogService sends JSON POST to /api/admin/catalog/services", async () => {
  const calls: { input: string; init: RequestInit }[] = [];
  const fetcher: AdminCatalogFetch = async (input, init) => {
    calls.push({ input: String(input), init: init ?? {} });
    return new Response(JSON.stringify({ success: true, data: { id: "2" } }), {
      headers: { "content-type": "application/json" },
    });
  };

  await createAdminCatalogService({ code: "temizlik", name: "Temizlik", base_price: 500 }, { fetcher });

  assert.equal(calls[0].input, "/api/admin/catalog/services");
  assert.equal(calls[0].init.method, "POST");
});

test("catalog client: updateAdminCatalogService sends JSON PATCH to /api/admin/catalog/services/:code", async () => {
  const calls: { input: string; init: RequestInit }[] = [];
  const fetcher: AdminCatalogFetch = async (input, init) => {
    calls.push({ input: String(input), init: init ?? {} });
    return new Response(JSON.stringify({ success: true, data: { id: "2" } }), {
      headers: { "content-type": "application/json" },
    });
  };

  await updateAdminCatalogService("temizlik", { is_active: false }, { fetcher });

  assert.equal(calls[0].input, "/api/admin/catalog/services/temizlik");
  assert.equal(calls[0].init.method, "PATCH");
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

test("catalog client: throws AdminCatalogClientError on failure envelope", async () => {
  const fetcher: AdminCatalogFetch = async () =>
    new Response(JSON.stringify({ success: false, error: "Admin role required" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });

  await assert.rejects(
    () => fetchAdminCatalogMainItems({ fetcher }),
    (err: unknown) => {
      assert.ok(err instanceof AdminCatalogClientError);
      assert.equal((err as AdminCatalogClientError).status, 403);
      assert.equal((err as AdminCatalogClientError).message, "Admin role required");
      return true;
    },
  );
});

test("catalog client: aborts timed out requests with typed timeout error", async () => {
  const fetcher: AdminCatalogFetch = async (_input, init) => {
    const signal = init?.signal;
    assert.ok(signal instanceof AbortSignal);
    return await new Promise<Response>((_resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      signal.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      );
    });
  };

  await assert.rejects(
    () => fetchAdminCatalogMainItems({ fetcher, requestTimeoutMs: 1 }),
    (err: unknown) => {
      assert.ok(err instanceof AdminCatalogClientError);
      assert.equal(err.status, 408);
      assert.match(err.message, /zaman aşımına uğradı/i);
      return true;
    },
  );
});
