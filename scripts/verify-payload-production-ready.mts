import { getPayload } from "payload";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const REQUIRED_PAYLOAD_COLLECTIONS = [
  "users",
  "blog_categories",
  "blog_posts",
  "consultants",
] as const;

type PayloadCollection = (typeof REQUIRED_PAYLOAD_COLLECTIONS)[number];

export type PayloadPreflightResult = {
  collection: string;
  ok: boolean;
  message?: string;
};

export function assertPayloadPreflightResults(results: PayloadPreflightResult[]): void {
  const failures = results.filter((result) => !result.ok);
  if (failures.length === 0) return;

  const detail = failures
    .map((failure) => `${failure.collection}: ${failure.message ?? "unknown error"}`)
    .join("; ");

  throw new Error(`Payload production preflight failed. ${detail}`);
}

export async function runPayloadProductionPreflight(): Promise<PayloadPreflightResult[]> {
  loadDotEnvLocal();
  const { default: configPromise } = await import("../payload.config.ts");
  const payload = await getPayload({ config: configPromise });

  const results: PayloadPreflightResult[] = [];
  for (const collection of REQUIRED_PAYLOAD_COLLECTIONS) {
    try {
      await payload.find({
        collection: collection as PayloadCollection,
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });
      results.push({ collection, ok: true });
    } catch (error) {
      results.push({
        collection,
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  assertPayloadPreflightResults(results);
  return results;
}

function loadDotEnvLocal(): void {
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  } catch {
    return;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

const isMain = process.argv[1]?.endsWith("verify-payload-production-ready.mts") === true;

if (isMain) {
  try {
    const results = await runPayloadProductionPreflight();
    console.log(
      `Payload production preflight: ok (${results.map((result) => result.collection).join(", ")})`,
    );
    process.exit(0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
