import path from "node:path";
import { fileURLToPath } from "node:url";

import { postgresAdapter } from "@payloadcms/db-postgres";
import { buildConfig } from "payload";

import { Users } from "./payload/collections/Users";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const databaseURI = process.env.DATABASE_URI;
const payloadSecret = process.env.PAYLOAD_SECRET;
const publicServerURL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const isProduction = process.env.NODE_ENV === "production";

if (!databaseURI) {
  console.warn("DATABASE_URI is not set. Payload DB connection will fail.");
}

if (!payloadSecret) {
  console.warn("PAYLOAD_SECRET is not set. Using an insecure dev fallback.");
}

if (isProduction && !databaseURI) {
  throw new Error("DATABASE_URI must be set in production");
}

if (isProduction && !payloadSecret) {
  throw new Error("PAYLOAD_SECRET must be set in production");
}

export default buildConfig({
  secret: payloadSecret ?? "dev-only-payload-secret",
  serverURL: publicServerURL,
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: dirname,
    },
  },
  db: postgresAdapter({
    pool: {
      connectionString:
        databaseURI ?? "postgres://postgres:postgres@127.0.0.1:5432/postgres",
    },
    schemaName: "payload",
  }),
  collections: [Users],
});
