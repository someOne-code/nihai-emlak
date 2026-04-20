import assert from "node:assert/strict";
import test from "node:test";

import {
  parseCheckoutCreateRequestBody,
  validateCheckoutCreateAvailability,
} from "../lib/payments/checkout-create.ts";

const validCheckoutCreatePayload = {
  listing_id: "11111111-1111-4111-8111-111111111111",
  move_in_date: "2026-05-20",
  stay_months: 6,
  guest_count: 2,
  main_items: ["deposit"],
  service_items: ["cleaning"],
  note: "Lutfen ogleden sonra arayin.",
};

test("parseCheckoutCreateRequestBody accepts and normalizes a valid checkout request", () => {
  const result = parseCheckoutCreateRequestBody({
    ...validCheckoutCreatePayload,
    listing_id: " 11111111-1111-4111-8111-AAAAAAAAAAAA ",
    main_items: [" Deposit "],
    service_items: [" Cleaning "],
    note: "  Lutfen ogleden sonra arayin.  ",
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    throw new Error("Expected valid checkout create payload");
  }

  assert.deepEqual(result.body, {
    listingId: "11111111-1111-4111-8111-aaaaaaaaaaaa",
    moveInDate: "2026-05-20",
    stayMonths: 6,
    guestCount: 2,
    mainItems: ["deposit"],
    serviceItems: ["cleaning"],
    note: "Lutfen ogleden sonra arayin.",
  });
});

test("parseCheckoutCreateRequestBody rejects malformed request bodies", () => {
  assert.deepEqual(parseCheckoutCreateRequestBody(null), {
    ok: false,
    status: 400,
    error: "Invalid checkout create request body",
  });

  assert.deepEqual(parseCheckoutCreateRequestBody([]), {
    ok: false,
    status: 400,
    error: "Invalid checkout create request body",
  });
});

test("parseCheckoutCreateRequestBody rejects invalid listing ids", () => {
  const result = parseCheckoutCreateRequestBody({
    ...validCheckoutCreatePayload,
    listing_id: "not-a-uuid",
  });

  assert.deepEqual(result, {
    ok: false,
    status: 400,
    error: "listing_id must be a UUID",
  });
});

test("parseCheckoutCreateRequestBody rejects invalid move-in dates", () => {
  const result = parseCheckoutCreateRequestBody({
    ...validCheckoutCreatePayload,
    move_in_date: "20/05/2026",
  });

  assert.deepEqual(result, {
    ok: false,
    status: 400,
    error: "move_in_date must be an ISO date",
  });
});

test("parseCheckoutCreateRequestBody rejects invalid stay and guest counts", () => {
  assert.deepEqual(
    parseCheckoutCreateRequestBody({
      ...validCheckoutCreatePayload,
      stay_months: 0,
    }),
    {
      ok: false,
      status: 400,
      error: "stay_months must be between 1 and 12",
    },
  );

  assert.deepEqual(
    parseCheckoutCreateRequestBody({
      ...validCheckoutCreatePayload,
      guest_count: 0,
    }),
    {
      ok: false,
      status: 400,
      error: "guest_count must be a positive integer",
    },
  );
});

test("parseCheckoutCreateRequestBody requires at least one main item", () => {
  const result = parseCheckoutCreateRequestBody({
    ...validCheckoutCreatePayload,
    main_items: [],
  });

  assert.deepEqual(result, {
    ok: false,
    status: 400,
    error: "main_items must include at least one item",
  });
});

test("parseCheckoutCreateRequestBody rejects duplicate main items", () => {
  const result = parseCheckoutCreateRequestBody({
    ...validCheckoutCreatePayload,
    main_items: ["deposit", " DEPOSIT "],
  });

  assert.deepEqual(result, {
    ok: false,
    status: 400,
    error: "main_items must not contain duplicates",
  });
});

test("parseCheckoutCreateRequestBody rejects duplicate service items", () => {
  const result = parseCheckoutCreateRequestBody({
    ...validCheckoutCreatePayload,
    service_items: ["cleaning", " CLEANING "],
  });

  assert.deepEqual(result, {
    ok: false,
    status: 400,
    error: "service_items must not contain duplicates",
  });
});

test("parseCheckoutCreateRequestBody rejects client-supplied financial totals", () => {
  const result = parseCheckoutCreateRequestBody({
    ...validCheckoutCreatePayload,
    total: 100,
  });

  assert.deepEqual(result, {
    ok: false,
    status: 400,
    error: "Client-supplied totals are not accepted",
  });
});

test("validateCheckoutCreateAvailability rejects missing listings", () => {
  const parsed = parseCheckoutCreateRequestBody(validCheckoutCreatePayload);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    throw new Error("Expected valid checkout create payload");
  }

  const result = validateCheckoutCreateAvailability(parsed.body, {
    listing: null,
    hasEnabledMainItems: false,
    mainItems: [],
    services: [],
  });

  assert.deepEqual(result, {
    ok: false,
    status: 404,
    error: "Listing not found",
  });
});

test("validateCheckoutCreateAvailability rejects passive listings", () => {
  const parsed = parseCheckoutCreateRequestBody(validCheckoutCreatePayload);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    throw new Error("Expected valid checkout create payload");
  }

  const result = validateCheckoutCreateAvailability(parsed.body, {
    listing: {
      id: parsed.body.listingId,
      type: "rent",
      status: "passive",
    },
    hasEnabledMainItems: true,
    mainItems: [
      {
        code: "deposit",
        isActive: true,
        isEnabledForListing: true,
      },
    ],
    services: [],
  });

  assert.deepEqual(result, {
    ok: false,
    status: 409,
    error: "Listing is not available for checkout",
  });
});

test("validateCheckoutCreateAvailability rejects sale listings", () => {
  const parsed = parseCheckoutCreateRequestBody(validCheckoutCreatePayload);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    throw new Error("Expected valid checkout create payload");
  }

  const result = validateCheckoutCreateAvailability(parsed.body, {
    listing: {
      id: parsed.body.listingId,
      type: "sale",
      status: "active",
    },
    hasEnabledMainItems: true,
    mainItems: [
      {
        code: "deposit",
        isActive: true,
        isEnabledForListing: true,
      },
    ],
    services: [],
  });

  assert.deepEqual(result, {
    ok: false,
    status: 409,
    error: "Listing is not available for checkout",
  });
});

test("validateCheckoutCreateAvailability rejects listings without any enabled main items", () => {
  const parsed = parseCheckoutCreateRequestBody(validCheckoutCreatePayload);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    throw new Error("Expected valid checkout create payload");
  }

  const result = validateCheckoutCreateAvailability(parsed.body, {
    listing: {
      id: parsed.body.listingId,
      type: "rent",
      status: "active",
    },
    hasEnabledMainItems: false,
    mainItems: [],
    services: [],
  });

  assert.deepEqual(result, {
    ok: false,
    status: 409,
    error: "Listing does not have any enabled main checkout items",
  });
});

test("validateCheckoutCreateAvailability rejects main items not enabled for the listing", () => {
  const parsed = parseCheckoutCreateRequestBody(validCheckoutCreatePayload);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    throw new Error("Expected valid checkout create payload");
  }

  const result = validateCheckoutCreateAvailability(parsed.body, {
    listing: {
      id: parsed.body.listingId,
      type: "rent",
      status: "active",
    },
    hasEnabledMainItems: true,
    mainItems: [
      {
        code: "deposit",
        isActive: true,
        isEnabledForListing: false,
      },
    ],
    services: [],
  });

  assert.deepEqual(result, {
    ok: false,
    status: 400,
    error: "main_items contains an item that is not enabled for this listing",
  });
});

test("validateCheckoutCreateAvailability rejects inactive main items", () => {
  const parsed = parseCheckoutCreateRequestBody(validCheckoutCreatePayload);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    throw new Error("Expected valid checkout create payload");
  }

  const result = validateCheckoutCreateAvailability(parsed.body, {
    listing: {
      id: parsed.body.listingId,
      type: "rent",
      status: "active",
    },
    hasEnabledMainItems: true,
    mainItems: [
      {
        code: "deposit",
        isActive: false,
        isEnabledForListing: true,
      },
    ],
    services: [],
  });

  assert.deepEqual(result, {
    ok: false,
    status: 400,
    error: "main_items contains an inactive item",
  });
});

test("validateCheckoutCreateAvailability rejects services not enabled for the listing", () => {
  const parsed = parseCheckoutCreateRequestBody(validCheckoutCreatePayload);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    throw new Error("Expected valid checkout create payload");
  }

  const result = validateCheckoutCreateAvailability(parsed.body, {
    listing: {
      id: parsed.body.listingId,
      type: "rent",
      status: "active",
    },
    hasEnabledMainItems: true,
    mainItems: [
      {
        code: "deposit",
        isActive: true,
        isEnabledForListing: true,
      },
    ],
    services: [
      {
        code: "cleaning",
        isActive: true,
        isEnabledForListing: false,
      },
    ],
  });

  assert.deepEqual(result, {
    ok: false,
    status: 400,
    error: "service_items contains a service that is not enabled for this listing",
  });
});

test("validateCheckoutCreateAvailability rejects inactive services", () => {
  const parsed = parseCheckoutCreateRequestBody(validCheckoutCreatePayload);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    throw new Error("Expected valid checkout create payload");
  }

  const result = validateCheckoutCreateAvailability(parsed.body, {
    listing: {
      id: parsed.body.listingId,
      type: "rent",
      status: "active",
    },
    hasEnabledMainItems: true,
    mainItems: [
      {
        code: "deposit",
        isActive: true,
        isEnabledForListing: true,
      },
    ],
    services: [
      {
        code: "cleaning",
        isActive: false,
        isEnabledForListing: true,
      },
    ],
  });

  assert.deepEqual(result, {
    ok: false,
    status: 409,
    error: "service_items contains an inactive service",
  });
});

test("validateCheckoutCreateAvailability accepts active listings with enabled active services", () => {
  const parsed = parseCheckoutCreateRequestBody(validCheckoutCreatePayload);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    throw new Error("Expected valid checkout create payload");
  }

  const result = validateCheckoutCreateAvailability(parsed.body, {
    listing: {
      id: parsed.body.listingId,
      type: "rent",
      status: "active",
    },
    hasEnabledMainItems: true,
    mainItems: [
      {
        code: "deposit",
        isActive: true,
        isEnabledForListing: true,
      },
    ],
    services: [
      {
        code: "cleaning",
        isActive: true,
        isEnabledForListing: true,
      },
    ],
  });

  assert.deepEqual(result, {
    ok: true,
  });
});
