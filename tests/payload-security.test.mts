import assert from "node:assert/strict";
import test from "node:test";

import {
  Users,
  canAccessPayloadAdmin,
  canManagePayloadUsers,
  canReadPayloadUsers,
  canUpdatePayloadUsers,
} from "../payload/collections/Users.ts";
import {
  backfillLegacyUserRolesMigrationName,
  getBackfillLegacyUserRolesSQL,
} from "../payload/migrations/backfill-legacy-user-roles.ts";
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

test("Payload server URL rejects VERCEL_URL-only bootstrap in production", () => {
  assert.throws(
    () =>
      resolvePayloadServerURL({
        nodeEnv: "production",
        publicSiteUrl: undefined,
        siteUrl: undefined,
        vercelUrl: "nihai-emlak-preview.vercel.app",
      }),
    /SITE_URL or NEXT_PUBLIC_SITE_URL must be configured outside development\/test/,
  );
});

test("Payload config passes VERCEL_URL into server URL bootstrap", async (t) => {
  const originalEnv = {
    DATABASE_URI: process.env.DATABASE_URI,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NODE_ENV: process.env.NODE_ENV,
    PAYLOAD_SECRET: process.env.PAYLOAD_SECRET,
    SITE_URL: process.env.SITE_URL,
    VERCEL_URL: process.env.VERCEL_URL,
  };

  t.after(() => {
    process.env.DATABASE_URI = originalEnv.DATABASE_URI;
    process.env.NEXT_PUBLIC_SITE_URL = originalEnv.NEXT_PUBLIC_SITE_URL;
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    process.env.PAYLOAD_SECRET = originalEnv.PAYLOAD_SECRET;
    process.env.SITE_URL = originalEnv.SITE_URL;
    process.env.VERCEL_URL = originalEnv.VERCEL_URL;
  });

  process.env.NODE_ENV = "test";
  delete process.env.SITE_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  process.env.VERCEL_URL = "nihai-emlak-preview.vercel.app";
  delete process.env.DATABASE_URI;
  delete process.env.PAYLOAD_SECRET;

  const payloadConfigModule = await import("../payload.config.ts");
  assert.equal(payloadConfigModule.payloadServerURL, "https://nihai-emlak-preview.vercel.app");
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

test("Payload legacy users without role keep admin access until backfill", () => {
  assert.equal(
    canAccessPayloadAdmin({
      req: {
        user: {
          collection: "users",
          role: null,
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
          role: null,
        },
      },
    }),
    true,
  );
});

test("Payload users without hydrated role field are not promoted to admin", () => {
  assert.equal(
    canAccessPayloadAdmin({
      req: {
        user: {
          collection: "users",
        },
      },
    }),
    false,
  );

  assert.equal(
    canManagePayloadUsers({
      req: {
        user: {
          collection: "users",
        },
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

test("Payload own-row fallback does not apply to other auth collections", () => {
  assert.equal(
    canReadPayloadUsers({
      req: {
        user: {
          collection: "customers",
          id: "user-1",
          role: "editor",
        },
      },
    }),
    false,
  );

  assert.equal(
    canUpdatePayloadUsers({
      req: {
        user: {
          collection: "customers",
          id: "user-1",
          role: "editor",
        },
      },
    }),
    false,
  );
});

test("Payload role field is required after legacy backfill migration is registered", () => {
  const roleField = Users.fields.find((field) => "name" in field && field.name === "role");

  assert.ok(roleField);
  assert.equal("required" in roleField ? roleField.required : undefined, true);
});

test("Payload editor role is disabled until content-editor workflows exist", () => {
  const roleField = Users.fields.find((field) => "name" in field && field.name === "role");

  assert.ok(roleField);
  assert.equal("defaultValue" in roleField ? roleField.defaultValue : undefined, "admin");
  assert.deepEqual(
    "options" in roleField ? roleField.options : undefined,
    [
      {
        label: "Admin",
        value: "admin",
      },
    ],
  );
});

test("Payload config registers legacy user role backfill migration", async () => {
  const payloadConfigModule = await import("../payload.config.ts");
  assert.equal(payloadConfigModule.payloadProdMigrations.length > 0, true);
  assert.equal(payloadConfigModule.payloadProdMigrations[0]?.name, backfillLegacyUserRolesMigrationName);
});

test("Legacy Payload user role backfill migration promotes null roles to admin", () => {
  const sqlText = getBackfillLegacyUserRolesSQL();

  assert.match(sqlText, /table_schema = 'payload'/);
  assert.match(sqlText, /table_name = 'users'/);
  assert.match(sqlText, /column_name = 'role'/);
  assert.match(sqlText, /update "payload"\."users"/i);
  assert.match(sqlText, /set "role" = 'admin'/i);
  assert.match(sqlText, /where "role" is null/i);
});
