import path from "node:path";
import { fileURLToPath } from "node:url";

import { postgresAdapter } from "@payloadcms/db-postgres";
import { buildConfig } from "payload";

import { resolvePayloadServerURL } from "./payload/server-url.ts";
import { Users } from "./payload/collections/Users.ts";
import { backfillLegacyUserRolesMigration } from "./payload/migrations/backfill-legacy-user-roles.ts";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const databaseURI = process.env.DATABASE_URI;
const payloadSecret = process.env.PAYLOAD_SECRET;
export const payloadServerURL = resolvePayloadServerURL({
  nodeEnv: process.env.NODE_ENV,
  publicSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  siteUrl: process.env.SITE_URL,
  vercelUrl: process.env.VERCEL_URL,
});
const isTest = process.env.NODE_ENV === "test";

if (!isTest && !databaseURI) {
  throw new Error("DATABASE_URI must be set outside test environment");
}

if (!isTest && !payloadSecret) {
  throw new Error("PAYLOAD_SECRET must be set outside test environment");
}

if (isTest && !databaseURI) {
  console.warn("DATABASE_URI is not set. Falling back to test-only local postgres URI.");
}

if (isTest && !payloadSecret) {
  console.warn("PAYLOAD_SECRET is not set. Falling back to test-only secret.");
}

const resolvedDatabaseURI =
  databaseURI ?? "postgres://postgres:postgres@127.0.0.1:5432/postgres";
const resolvedPayloadSecret = payloadSecret ?? "test-only-payload-secret";
export const payloadProdMigrations = [backfillLegacyUserRolesMigration];

export default buildConfig({
  secret: resolvedPayloadSecret,
  serverURL: payloadServerURL,
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: dirname,
    },
  },
  db: postgresAdapter({
    pool: {
      connectionString: resolvedDatabaseURI,
    },
    prodMigrations: payloadProdMigrations,
    schemaName: "payload",
  }),
  collections: [Users],
});
