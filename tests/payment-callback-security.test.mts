import assert from "node:assert/strict";
import test from "node:test";

import {
  buildIsbankHostedPaymentCallbackKey,
  extractPaymentCallbackReference,
  extractPaymentIdHintFromCallback,
  getSupportedPaymentCallbackContentType,
  parsePaymentCallbackPayload,
  readPaymentCallbackRawRequestBody,
  readPaymentCallbackRawBody,
  sha256Upper,
} from "../lib/payments/callback.ts";

test("supports only expected callback content types", () => {
  assert.equal(
    getSupportedPaymentCallbackContentType("application/x-www-form-urlencoded; charset=utf-8"),
    "application/x-www-form-urlencoded",
  );
  assert.equal(
    getSupportedPaymentCallbackContentType("application/json"),
    "application/json",
  );
  assert.equal(
    getSupportedPaymentCallbackContentType("text/plain"),
    null,
  );
});

test("rejects oversized callback body", () => {
  const oversizedBody = Buffer.alloc((16 * 1024) + 1, "a");
  const result = readPaymentCallbackRawBody(
    oversizedBody.buffer.slice(
      oversizedBody.byteOffset,
      oversizedBody.byteOffset + oversizedBody.byteLength,
    ),
  );

  assert.equal(result.ok, false);
  if (result.ok) {
    throw new Error("Expected oversized callback body to fail");
  }
  assert.equal(result.status, 413);
});

test("rejects oversized callback request while streaming", async () => {
  const oversizedBody = Buffer.alloc((16 * 1024) + 1, "a");
  const request = new Request("http://localhost/api/payment/callback", {
    method: "POST",
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(oversizedBody.subarray(0, 8 * 1024));
        controller.enqueue(oversizedBody.subarray(8 * 1024));
        controller.close();
      },
    }),
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  const result = await readPaymentCallbackRawRequestBody(request);

  assert.equal(result.ok, false);
  if (result.ok) {
    throw new Error("Expected streamed oversized callback body to fail");
  }
  assert.equal(result.status, 413);
});

test("parses x-www-form-urlencoded callback payload", () => {
  const result = parsePaymentCallbackPayload(
    "clientid=123&oid=ORDER-1&Response=Approved",
    "application/x-www-form-urlencoded",
  );

  assert.equal(result.ok, true);
  if (!result.ok) {
    throw new Error("Expected form callback payload to parse");
  }

  assert.equal(result.payload.clientid, "123");
  assert.equal(result.payload.oid, "ORDER-1");
  assert.equal(result.payload.Response, "Approved");
});

test("rejects non-object JSON payloads", () => {
  const result = parsePaymentCallbackPayload(
    '["not-an-object"]',
    "application/json",
  );

  assert.equal(result.ok, false);
  if (result.ok) {
    throw new Error("Expected array JSON payload to fail");
  }
  assert.equal(result.status, 400);
});

test("builds stable hosted payment callback key", () => {
  const payload = {
    oid: "ORDER-42",
    HostRefNum: "HOST-9",
    ProcReturnCode: "00",
    Response: "Approved",
  };
  const payloadHash = sha256Upper("sample-payload");

  const eventKey = buildIsbankHostedPaymentCallbackKey(
    payload,
    "ABCDEF0123456789ABCDEF0123456789ABCDEF01",
    payloadHash,
  );

  assert.match(
    eventKey,
    /^isbank:ORDER-42:-:-:HOST-9:-:00:APPROVED:ABCDEF0123456789ABCDEF0123456789ABCDEF01:[A-F0-9]{64}$/,
  );
});

test("extracts callback payment reference from oid case-insensitively", () => {
  const reference = extractPaymentCallbackReference({
    OID: "  ORDER-900  ",
  });

  assert.equal(reference, "ORDER-900");
});

test("prefers signed oid over explicit payment_id for payment hint", () => {
  const paymentIdHint = extractPaymentIdHintFromCallback({
    payment_id: " 11111111-1111-1111-1111-111111111111 ",
    oid: " 22222222-2222-2222-2222-222222222222 ",
  });

  assert.equal(paymentIdHint, "22222222-2222-2222-2222-222222222222");
});

test("falls back to explicit payment_id when oid is absent", () => {
  const paymentIdHint = extractPaymentIdHintFromCallback({
    payment_id: " 33333333-3333-3333-3333-333333333333 ",
  });

  assert.equal(paymentIdHint, "33333333-3333-3333-3333-333333333333");
});
