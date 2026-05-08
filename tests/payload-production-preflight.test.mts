import assert from "node:assert/strict";
import test from "node:test";

import {
  REQUIRED_PAYLOAD_COLLECTIONS,
  assertPayloadPreflightResults,
} from "../scripts/verify-payload-production-ready.mts";

test("Payload production preflight checks every admin/content collection", () => {
  assert.deepEqual(REQUIRED_PAYLOAD_COLLECTIONS, [
    "users",
    "blog_categories",
    "blog_posts",
    "consultants",
  ]);
});

test("Payload production preflight fails closed with collection names", () => {
  assert.throws(
    () =>
      assertPayloadPreflightResults([
        { collection: "users", ok: true },
        { collection: "blog_posts", ok: false, message: 'relation "payload.blog_posts" does not exist' },
      ]),
    /Payload production preflight failed.*blog_posts.*payload\.blog_posts/s,
  );
});

test("Payload production preflight accepts successful probes", () => {
  assert.doesNotThrow(() =>
    assertPayloadPreflightResults([
      { collection: "users", ok: true },
      { collection: "blog_categories", ok: true },
      { collection: "blog_posts", ok: true },
      { collection: "consultants", ok: true },
    ]),
  );
});
