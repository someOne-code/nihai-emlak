import assert from "node:assert/strict";
import test from "node:test";

import {
  formatListingPrice,
  getListingBadgeLabel,
  getListingDetailImages,
  getListingFeatures,
  getListingLocation,
  getListingPrimaryImage,
} from "../lib/mappers/listing.mapper.ts";
import { apiFetch } from "../lib/api/client.ts";
import { buildSaleLeadPayload } from "../lib/api/sale-leads.ts";
import { getLoginRedirectUrl } from "../lib/auth/redirect.ts";
import type { ApiListingDetail, ApiListingListItem } from "../types/listing.ts";

const rentListing = {
  id: "11111111-1111-4111-8111-111111111111",
  type: "rent",
  status: "active",
  title: "Kiralık Daire",
  slug: "kiralik-daire",
  summary: "Merkezi konum",
  city: "Istanbul",
  district: "Kadikoy",
  price: "35000.00",
  currency: "TRY",
  room_count: 3,
  bathroom_count: 2,
  gross_area_m2: "120.50",
  is_furnished: true,
  primary_image_url: "https://example.com/cover.jpg",
  created_at: "2026-05-12T10:00:00.000Z",
} satisfies ApiListingListItem;

const saleListing = {
  ...rentListing,
  type: "sale",
  title: "Satılık Villa",
  price: 4250000,
  primary_image_url: null,
} satisfies ApiListingListItem;

test("listing mapper formats rent and sale listing summaries for public cards", () => {
  assert.equal(formatListingPrice(rentListing), "₺35.000 / ay");
  assert.equal(formatListingPrice(saleListing), "₺4.250.000");
  assert.equal(getListingBadgeLabel(rentListing), "Kiralık");
  assert.equal(getListingBadgeLabel(saleListing), "Satılık");
  assert.equal(getListingPrimaryImage(rentListing), "https://example.com/cover.jpg");
  assert.equal(getListingPrimaryImage(saleListing), "/property-nextjs-pro/placeholder-property.jpg");
  assert.equal(getListingLocation(rentListing), "Kadikoy, Istanbul");
  assert.deepEqual(getListingFeatures(rentListing), [
    "3 oda",
    "2 banyo",
    "120.5 m²",
    "Eşyalı",
  ]);
});

test("listing mapper uses detail gallery images before fallback", () => {
  const detail = {
    ...rentListing,
    description: "Detaylı açıklama",
    images: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        image_url: "https://example.com/detail.jpg",
        alt_text: "Salon",
        sort_order: 0,
        is_primary: true,
      },
    ],
    updated_at: "2026-05-12T11:00:00.000Z",
  } satisfies ApiListingDetail;

  assert.deepEqual(getListingDetailImages(detail), [
    {
      id: "22222222-2222-4222-8222-222222222222",
      src: "https://example.com/detail.jpg",
      alt: "Salon",
      isPrimary: true,
    },
  ]);

  assert.deepEqual(getListingDetailImages({ ...detail, images: [] }), [
    {
      id: "fallback",
      src: "/property-nextjs-pro/placeholder-property.jpg",
      alt: "Kiralık Daire",
      isPrimary: true,
    },
  ]);
});

test("login redirect helper encodes in-app paths for auth-required listing actions", () => {
  assert.equal(
    getLoginRedirectUrl("/listings/11111111-1111-4111-8111-111111111111?tab=chat"),
    "/auth/login?redirect=%2Flistings%2F11111111-1111-4111-8111-111111111111%3Ftab%3Dchat",
  );
});

test("sale lead helper builds the snake_case backend payload", () => {
  assert.deepEqual(
    buildSaleLeadPayload({
      listingId: "11111111-1111-4111-8111-111111111111",
      contactName: "Ali Veli",
      contactEmail: "ALI@EXAMPLE.COM",
      contactPhone: " +905551112233 ",
      message: "Bu satılık ilanla ilgileniyorum.",
    }),
    {
      listing_id: "11111111-1111-4111-8111-111111111111",
      contact_name: "Ali Veli",
      contact_email: "ali@example.com",
      contact_phone: "+905551112233",
      message: "Bu satılık ilanla ilgileniyorum.",
    },
  );
});

test("server API helper fails closed in production without a canonical origin", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSiteUrl = process.env.SITE_URL;
  const previousPublicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  try {
    process.env.NODE_ENV = "production";
    delete process.env.SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;

    await assert.rejects(
      apiFetch("/api/public/listings"),
      /SITE_URL or NEXT_PUBLIC_SITE_URL/,
    );
  } finally {
    restoreEnv("NODE_ENV", previousNodeEnv);
    restoreEnv("SITE_URL", previousSiteUrl);
    restoreEnv("NEXT_PUBLIC_SITE_URL", previousPublicSiteUrl);
  }
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
