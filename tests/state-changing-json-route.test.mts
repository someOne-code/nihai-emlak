import assert from "node:assert/strict";
import test from "node:test";

import {
  readStateChangingJsonRequestPayload,
  resolveTrustedOriginsFromEnvironment,
  type StateChangingJsonRouteConfig,
} from "../lib/http/state-changing-json-route.ts";

const TEST_ROUTE_CONFIG: StateChangingJsonRouteConfig = {
  maxBodyBytes: 1024,
  routeLabel: "Test route",
};

test("readStateChangingJsonRequestPayload uses emptyBodyValue when body is missing", async () => {
  const response = await readStateChangingJsonRequestPayload(
    new Request("http://localhost:3000/api/test", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
    }),
    TEST_ROUTE_CONFIG,
    { emptyBodyValue: {} },
  );

  assert.equal(response.ok, true);
  if (response.ok) {
    assert.deepEqual(response.value, {});
  }
});

test("readStateChangingJsonRequestPayload rejects empty body without emptyBodyValue override", async () => {
  const response = await readStateChangingJsonRequestPayload(
    new Request("http://localhost:3000/api/test", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
    }),
    TEST_ROUTE_CONFIG,
  );

  assert.equal(response.ok, false);
  if (!response.ok) {
    assert.equal(response.status, 400);
    assert.equal(response.error, "Invalid JSON request body");
  }
});

test("resolveTrustedOriginsFromEnvironment fails closed in production for site-url-only without SITE_URL", (t) => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSiteUrl = process.env.SITE_URL;
  const previousPublicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const previousVercelUrl = process.env.VERCEL_URL;

  process.env.NODE_ENV = "production";
  delete process.env.SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.example.com";
  delete process.env.VERCEL_URL;

  t.after(() => {
    restoreEnv("NODE_ENV", previousNodeEnv);
    restoreEnv("SITE_URL", previousSiteUrl);
    restoreEnv("NEXT_PUBLIC_SITE_URL", previousPublicSiteUrl);
    restoreEnv("VERCEL_URL", previousVercelUrl);
  });

  const result = resolveTrustedOriginsFromEnvironment({
    invalidConfigError: "invalid",
    missingConfigError: "SITE_URL missing",
    strategy: "site-url-only",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 500);
    assert.equal(result.error, "SITE_URL missing");
  }
});

test("resolveTrustedOriginsFromEnvironment site-url-only uses only SITE_URL when both are configured", (t) => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSiteUrl = process.env.SITE_URL;
  const previousPublicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const previousVercelUrl = process.env.VERCEL_URL;

  process.env.NODE_ENV = "production";
  process.env.SITE_URL = "https://admin.example.com/internal";
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.example.com";
  delete process.env.VERCEL_URL;

  t.after(() => {
    restoreEnv("NODE_ENV", previousNodeEnv);
    restoreEnv("SITE_URL", previousSiteUrl);
    restoreEnv("NEXT_PUBLIC_SITE_URL", previousPublicSiteUrl);
    restoreEnv("VERCEL_URL", previousVercelUrl);
  });

  const result = resolveTrustedOriginsFromEnvironment({
    invalidConfigError: "invalid",
    strategy: "site-url-only",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.origins, ["https://admin.example.com"]);
  }
});

test("resolveTrustedOriginsFromEnvironment site-url-only keeps localhost fallback in test mode", (t) => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSiteUrl = process.env.SITE_URL;
  const previousPublicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const previousVercelUrl = process.env.VERCEL_URL;

  process.env.NODE_ENV = "test";
  delete process.env.SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.example.com";
  delete process.env.VERCEL_URL;

  t.after(() => {
    restoreEnv("NODE_ENV", previousNodeEnv);
    restoreEnv("SITE_URL", previousSiteUrl);
    restoreEnv("NEXT_PUBLIC_SITE_URL", previousPublicSiteUrl);
    restoreEnv("VERCEL_URL", previousVercelUrl);
  });

  const result = resolveTrustedOriginsFromEnvironment({
    invalidConfigError: "invalid",
    strategy: "site-url-only",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.origins, ["http://localhost:3000"]);
  }
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
