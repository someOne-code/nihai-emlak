import crypto from "node:crypto";

import {
  findCaseInsensitiveValue,
  normalizePaymentPayload,
  type LooseRecord,
} from "./isbank.ts";

export const MAX_PAYMENT_CALLBACK_BYTES = 16 * 1024;

const SUPPORTED_CALLBACK_CONTENT_TYPES = [
  "application/json",
  "application/x-www-form-urlencoded",
] as const;

export type SupportedPaymentCallbackContentType =
  (typeof SUPPORTED_CALLBACK_CONTENT_TYPES)[number];

export function getSupportedPaymentCallbackContentType(
  contentTypeHeader: string | null | undefined,
): SupportedPaymentCallbackContentType | null {
  const normalized = contentTypeHeader?.toLowerCase() ?? "";

  for (const supportedType of SUPPORTED_CALLBACK_CONTENT_TYPES) {
    if (normalized.includes(supportedType)) {
      return supportedType;
    }
  }

  return null;
}

export function readPaymentCallbackRawBody(
  arrayBuffer: ArrayBuffer,
  maxBytes = MAX_PAYMENT_CALLBACK_BYTES,
): { ok: true; rawBody: string } | { ok: false; status: number; error: string } {
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.byteLength === 0) {
    return {
      ok: false,
      status: 400,
      error: "Empty callback payload",
    };
  }

  if (buffer.byteLength > maxBytes) {
    return {
      ok: false,
      status: 413,
      error: "Callback payload is too large",
    };
  }

  return {
    ok: true,
    rawBody: buffer.toString("utf8"),
  };
}

export async function readPaymentCallbackRawRequestBody(
  request: Request,
  maxBytes = MAX_PAYMENT_CALLBACK_BYTES,
): Promise<{ ok: true; rawBody: string } | { ok: false; status: number; error: string }> {
  try {
    if (!request.body) {
      return readPaymentCallbackRawBody(await request.arrayBuffer(), maxBytes);
    }

    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel();
          return {
            ok: false,
            status: 413,
            error: "Callback payload is too large",
          };
        }

        chunks.push(value);
      }
    } catch {
      return {
        ok: false,
        status: 400,
        error: "Invalid callback payload",
      };
    } finally {
      reader.releaseLock();
    }

    if (totalBytes === 0) {
      return {
        ok: false,
        status: 400,
        error: "Empty callback payload",
      };
    }

    return {
      ok: true,
      rawBody: Buffer.concat(chunks, totalBytes).toString("utf8"),
    };
  } catch {
    return {
      ok: false,
      status: 400,
      error: "Invalid callback payload",
    };
  }
}

export function parsePaymentCallbackPayload(
  rawBody: string,
  contentType: SupportedPaymentCallbackContentType,
): { ok: true; payload: LooseRecord } | { ok: false; status: number; error: string } {
  try {
    if (contentType === "application/json") {
      const parsed = JSON.parse(rawBody);

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {
          ok: false,
          status: 400,
          error: "Invalid callback payload format",
        };
      }

      return {
        ok: true,
        payload: normalizePaymentPayload(parsed),
      };
    }

    const formData = Object.fromEntries(new URLSearchParams(rawBody).entries());
    return {
      ok: true,
      payload: normalizePaymentPayload(formData),
    };
  } catch {
    return {
      ok: false,
      status: 400,
      error: "Invalid callback payload format",
    };
  }
}

export function sha256Upper(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex").toUpperCase();
}

export function extractPaymentCallbackReference(payload: LooseRecord): string | null {
  return readTrimmedCallbackValue(payload, ["oid"]);
}

export function extractPaymentIdHintFromCallback(payload: LooseRecord): string | null {
  const signedReference = extractPaymentCallbackReference(payload);
  if (signedReference) {
    return signedReference;
  }

  return extractExplicitPaymentIdFromCallback(payload);
}

export function extractExplicitPaymentIdFromCallback(payload: LooseRecord): string | null {
  return readTrimmedCallbackValue(payload, [
    "payment_id",
    "paymentid",
    "paymentuuid",
    "payment_uuid",
  ]);
}

export function buildIsbankHostedPaymentCallbackKey(
  payload: LooseRecord,
  providedHash: string,
  payloadHash: string,
): string {
  const keyParts = [
    "isbank",
    readCallbackKeyPart(payload, "oid"),
    readCallbackKeyPart(payload, "xid"),
    readCallbackKeyPart(payload, "transid"),
    readCallbackKeyPart(payload, "hostrefnum"),
    readCallbackKeyPart(payload, "authcode"),
    readCallbackKeyPart(payload, "procreturncode"),
    readCallbackKeyPart(payload, "response"),
    providedHash.trim().toUpperCase(),
    payloadHash.trim().toUpperCase(),
  ];

  return keyParts.join(":");
}

function readCallbackKeyPart(payload: LooseRecord, field: string): string {
  const value = findCaseInsensitiveValue(payload, field);

  if (typeof value !== "string" || value.trim().length === 0) {
    return "-";
  }

  return value.trim().toUpperCase();
}

function readTrimmedCallbackValue(
  payload: LooseRecord,
  fieldNames: readonly string[],
): string | null {
  for (const fieldName of fieldNames) {
    const value = findCaseInsensitiveValue(payload, fieldName);
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}
