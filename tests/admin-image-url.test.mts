import assert from "node:assert/strict";
import test from "node:test";

import { resolveAdminDisplayImageUrl } from "../lib/admin-ui/admin-image-url.ts";

test("admin display image URLs allow same-origin and Supabase storage images", () => {
  assert.equal(
    resolveAdminDisplayImageUrl("/media/listing.jpg", {
      currentOrigin: "http://localhost:3000",
      supabaseUrl: "https://project.supabase.co",
    }),
    "/media/listing.jpg",
  );
  assert.equal(
    resolveAdminDisplayImageUrl("https://project.supabase.co/storage/v1/object/public/listings/a.jpg", {
      currentOrigin: "http://localhost:3000",
      supabaseUrl: "https://project.supabase.co",
    }),
    "https://project.supabase.co/storage/v1/object/public/listings/a.jpg",
  );
});

test("admin display image URLs suppress external origins that would be blocked by CSP", () => {
  assert.equal(
    resolveAdminDisplayImageUrl("https://example.com/phase5-active.jpg", {
      currentOrigin: "http://localhost:3000",
      supabaseUrl: "https://project.supabase.co",
    }),
    null,
  );
});
