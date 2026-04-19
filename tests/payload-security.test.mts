import assert from "node:assert/strict";
import test from "node:test";

import { resolvePayloadServerURL } from "../payload/server-url.ts";

test("Payload server URL fails closed outside development/test", () => {
  assert.throws(
    () =>
      resolvePayloadServerURL({
        nodeEnv: "production",
        publicSiteUrl: undefined,
        siteUrl: undefined,
      }),
    /SITE_URL or NEXT_PUBLIC_SITE_URL must be configured outside development\/test/,
  );
});

test("Payload server URL rejects non-http origins", () => {
  assert.throws(
    () =>
      resolvePayloadServerURL({
        nodeEnv: "production",
        publicSiteUrl: "javascript:alert(1)",
        siteUrl: undefined,
      }),
    /must use http or https/,
  );
});

test("Payload server URL prefers private SITE_URL and normalizes to origin", () => {
  const result = resolvePayloadServerURL({
    nodeEnv: "production",
    publicSiteUrl: "https://public.example.com",
    siteUrl: "https://admin.example.com/some/path",
  });

  assert.equal(result, "https://admin.example.com");
});
