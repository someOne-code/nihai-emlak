import assert from "node:assert/strict";
import test from "node:test";

import {
  canAccessPayloadAdmin,
  canManagePayloadUsers,
  canReadPayloadUsers,
  canUpdatePayloadUsers,
} from "../payload/collections/Users.ts";
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

test("Payload users admin surface requires admin role", () => {
  assert.equal(
    canAccessPayloadAdmin({
      req: {
        user: {
          collection: "users",
          role: "admin",
        },
      },
    }),
    true,
  );

  assert.equal(
    canAccessPayloadAdmin({
      req: {
        user: {
          collection: "users",
          role: "editor",
        },
      },
    }),
    false,
  );

  assert.equal(
    canAccessPayloadAdmin({
      req: {
        user: undefined,
      },
    }),
    false,
  );
});

test("Payload users collection management requires admin role", () => {
  assert.equal(
    canManagePayloadUsers({
      req: {
        user: {
          collection: "users",
          role: "admin",
        },
      },
    }),
    true,
  );

  assert.equal(
    canManagePayloadUsers({
      req: {
        user: {
          collection: "users",
          role: "editor",
        },
      },
    }),
    false,
  );
});

test("Payload non-admin users can only read and update their own row", () => {
  const ownRead = canReadPayloadUsers({
    req: {
      user: {
        collection: "users",
        id: "user-1",
        role: "editor",
      },
    },
  });

  assert.deepEqual(ownRead, {
    id: {
      equals: "user-1",
    },
  });

  const ownUpdate = canUpdatePayloadUsers({
    req: {
      user: {
        collection: "users",
        id: "user-1",
        role: "editor",
      },
    },
  });

  assert.deepEqual(ownUpdate, {
    id: {
      equals: "user-1",
    },
  });

  assert.equal(
    canReadPayloadUsers({
      req: {
        user: undefined,
      },
    }),
    false,
  );
});
