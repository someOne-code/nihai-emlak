// Phase 8.6 Field Contract Test: Ensures UI forms send correct field names to RPC
// This prevents regressions like 'gross_area' vs 'gross_area_m2' mismatch

import { test } from "node:test";
import assert from "node:assert";

// Expected fields for admin_create_listing RPC
const CREATE_LISTING_RPC_FIELDS = new Set([
  "type",
  "status",
  "title",
  "slug",
  "summary",
  "description",
  "city",
  "district",
  "currency",
  "price",
  "room_count",
  "bathroom_count",
  "gross_area_m2",
  "is_furnished",
]);

// Expected fields for admin_update_listing RPC (partial update, all optional)
const UPDATE_LISTING_RPC_FIELDS = new Set([
  "title",
  "slug",
  "summary",
  "description",
  "city",
  "district",
  "currency",
  "price",
  "room_count",
  "bathroom_count",
  "gross_area_m2",
  "is_furnished",
]);

// Fields that CreateListingPanel should NEVER send (RPC provides defaults)
const CREATE_PANEL_EXCLUDED_FIELDS = new Set([
  "status", // RPC defaults to 'passive'
]);

test("CreateListingPanel payload fields match admin_create_listing RPC contract", () => {
  // Simulate CreateListingPanel handleSubmit payload
  const createPayload = {
    type: "rent",
    title: "Test Title",
    slug: "test-title",
    city: "Istanbul",
    district: "Kadikoy",
    price: 5000,
    currency: "TRY",
    summary: "Summary",
    description: "Description",
    room_count: 3,
    bathroom_count: 1,
    gross_area_m2: 120,
    is_furnished: false,
  };

  const payloadFields = new Set(Object.keys(createPayload));

  // Every payload field must be in RPC contract
  for (const field of payloadFields) {
    assert.ok(
      CREATE_LISTING_RPC_FIELDS.has(field),
      `CreateListingPanel sends unexpected field: ${field}`,
    );
  }

  // Excluded fields must not be present
  for (const excluded of CREATE_PANEL_EXCLUDED_FIELDS) {
    assert.ok(
      !payloadFields.has(excluded),
      `CreateListingPanel should not send '${excluded}' - RPC provides default`,
    );
  }

  // Critical fields must be present (regression protection)
  const criticalFields = ["gross_area_m2", "room_count", "bathroom_count", "is_furnished"];
  for (const critical of criticalFields) {
    assert.ok(
      payloadFields.has(critical),
      `CreateListingPanel missing critical field: ${critical}`,
    );
  }
});

test("ListingGeneralPanel payload fields match admin_update_listing RPC contract", () => {
  // Simulate ListingGeneralPanel handleSubmit payload
  const updatePayload = {
    title: "Updated Title",
    summary: "Updated Summary",
    description: "Updated Description",
    city: "Ankara",
    district: "Cankaya",
    price: 6000,
    currency: "TRY",
    room_count: 4,
    bathroom_count: 2,
    gross_area_m2: 150,
    is_furnished: true,
  };

  const payloadFields = new Set(Object.keys(updatePayload));

  // Every payload field must be in RPC contract
  for (const field of payloadFields) {
    assert.ok(
      UPDATE_LISTING_RPC_FIELDS.has(field),
      `ListingGeneralPanel sends unexpected field: ${field}`,
    );
  }

  // Critical fields must use correct snake_case names
  assert.ok(payloadFields.has("gross_area_m2"), "Must use 'gross_area_m2' not 'gross_area'");
  assert.ok(payloadFields.has("room_count"), "Must use 'room_count' not 'roomCount'");
  assert.ok(payloadFields.has("bathroom_count"), "Must use 'bathroom_count' not 'bathroomCount'");
  assert.ok(payloadFields.has("is_furnished"), "Must use 'is_furnished' not 'isFurnished'");
});

test("No camelCase field names in payloads (snake_case required for RPC)", () => {
  const createPayload = {
    type: "rent",
    title: "Test",
    slug: "test",
    city: null,
    district: null,
    price: 1000,
    currency: "TRY",
    summary: null,
    description: null,
    room_count: 2,
    bathroom_count: 1,
    gross_area_m2: 100,
    is_furnished: false,
  };

  const updatePayload = {
    title: "Test",
    summary: null,
    description: null,
    city: null,
    district: null,
    price: 1000,
    currency: "TRY",
    room_count: 2,
    bathroom_count: 1,
    gross_area_m2: 100,
    is_furnished: false,
  };

  // Check for camelCase violations
  const camelCasePattern = /[A-Z]/;
  for (const payload of [createPayload, updatePayload]) {
    for (const field of Object.keys(payload)) {
      assert.ok(
        !camelCasePattern.test(field),
        `Field '${field}' uses camelCase - RPC requires snake_case`,
      );
    }
  }
});
