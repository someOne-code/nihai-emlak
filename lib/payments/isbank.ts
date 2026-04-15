import crypto from "node:crypto";

export type Primitive = string | number | boolean | null | undefined;
export type LooseRecord = Record<string, Primitive>;

const DEFAULT_HASH_FIELDS = [
  "clientid",
  "oid",
  "amount",
  "okurl",
  "failurl",
  "txnType",
  "instalment",
  "rnd",
] as const;

const SHA1_HEX_UPPER_LENGTH = 40;

export function normalizePaymentPayload(payload: unknown): LooseRecord {
  if (!payload || typeof payload !== "object") return {};

  const normalized: LooseRecord = {};
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null ||
      value === undefined
    ) {
      normalized[key] = value;
    }
  }

  return normalized;
}

function asString(value: Primitive): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

export function findCaseInsensitiveValue(
  payload: LooseRecord,
  field: string,
): Primitive | undefined {
  const matchedKey = Object.keys(payload).find(
    (key) => key.toLowerCase() === field.toLowerCase(),
  );

  if (!matchedKey) return undefined;
  return payload[matchedKey];
}

export function buildIsbankSha1Input(
  payload: LooseRecord,
  storeKey: string,
  fields = DEFAULT_HASH_FIELDS,
): string {
  const joined = fields
    .map((field) => asString(findCaseInsensitiveValue(payload, field)))
    .join("");

  return `${joined}${storeKey}`;
}

export function sha1Upper(input: string): string {
  return crypto.createHash("sha1").update(input, "utf8").digest("hex").toUpperCase();
}

export function safeCompareHash(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

export function extractProvidedHash(payload: LooseRecord, headerHash?: string | null): string {
  const candidates = [
    headerHash,
    findCaseInsensitiveValue(payload, "HASH"),
    findCaseInsensitiveValue(payload, "hash"),
    findCaseInsensitiveValue(payload, "isbank_hash"),
  ];

  const first = candidates.find(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );
  return first ? first.trim().toUpperCase() : "";
}

export function isValidSha1Hex(value: string): boolean {
  return /^[A-F0-9]{40}$/.test(value);
}

export function hasRequiredIsbankFields(
  payload: LooseRecord,
  fields = DEFAULT_HASH_FIELDS,
): boolean {
  return fields.every((field) => {
    const value = findCaseInsensitiveValue(payload, field);
    return typeof value === "string" && value.trim().length > 0;
  });
}

export function getSha1HexLength(): number {
  return SHA1_HEX_UPPER_LENGTH;
}
