import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  formatListingPrice,
  getListingBadgeLabel,
  getListingDetailImages,
  getListingDetailFeatureRows,
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
  primary_image_url: "https://project.supabase.co/storage/v1/object/public/content-media/listing-images/cover.jpg",
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
  assert.equal(
    getListingPrimaryImage(rentListing),
    "https://project.supabase.co/storage/v1/object/public/content-media/listing-images/cover.jpg",
  );
  assert.equal(getListingPrimaryImage(saleListing), "/property-nextjs-pro/placeholder-property.jpg");
  assert.equal(getListingLocation(rentListing), "Kadikoy, Istanbul");
  assert.deepEqual(getListingFeatures(rentListing), [
    "3 oda",
    "2 banyo",
    "120.5 m²",
    "Eşyalı",
  ]);
});

test("listing mapper prefers optimized card image variant before legacy primary image", () => {
  const listing = {
    ...rentListing,
    primary_image_url: "https://project.supabase.co/storage/v1/object/public/content-media/listing-images/original.jpg",
    primary_image_card_url: "https://project.supabase.co/storage/v1/object/public/content-media/listing-images/card.webp",
  } satisfies ApiListingListItem;

  assert.equal(
    getListingPrimaryImage(listing),
    "https://project.supabase.co/storage/v1/object/public/content-media/listing-images/card.webp",
  );

  assert.equal(
    getListingPrimaryImage({
      ...listing,
      primary_image_card_url: null,
    }),
    "https://project.supabase.co/storage/v1/object/public/content-media/listing-images/original.jpg",
  );
});

test("listing mapper uses detail gallery images before fallback", () => {
  const detail = {
    ...rentListing,
    description: "Detaylı açıklama",
    heating_type: "central",
    fuel_type: "natural_gas",
    balcony_count: 2,
    has_elevator: true,
    parking_type: "open_closed",
    in_site: false,
    building_age: 5,
    floor_count: 12,
    floor_number: "3. Kat",
    usage_status: "tenant_occupied",
    facade: "Guney Bati",
    images: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        image_url: "https://project.supabase.co/storage/v1/object/public/content-media/listing-images/detail.jpg",
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
      src: "https://project.supabase.co/storage/v1/object/public/content-media/listing-images/detail.jpg",
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

test("listing mapper prefers optimized detail image variant for gallery images", () => {
  const detail = {
    ...rentListing,
    description: "Detayli aciklama",
    heating_type: null,
    fuel_type: null,
    balcony_count: null,
    has_elevator: null,
    parking_type: null,
    in_site: null,
    building_age: null,
    floor_count: null,
    floor_number: null,
    usage_status: null,
    facade: null,
    images: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        image_url: "https://project.supabase.co/storage/v1/object/public/content-media/listing-images/original.jpg",
        card_image_url: "https://project.supabase.co/storage/v1/object/public/content-media/listing-images/card.webp",
        detail_image_url: "https://project.supabase.co/storage/v1/object/public/content-media/listing-images/detail.webp",
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
      src: "https://project.supabase.co/storage/v1/object/public/content-media/listing-images/detail.webp",
      alt: "Salon",
      isPrimary: true,
    },
  ]);
});

test("listing detail feature rows expose backend housing fields with Turkish labels", () => {
  const detail = {
    ...rentListing,
    description: "Detayli aciklama",
    heating_type: "central",
    fuel_type: "natural_gas",
    balcony_count: 2,
    has_elevator: true,
    parking_type: "open",
    in_site: false,
    building_age: 5,
    floor_count: 12,
    floor_number: "3. Kat",
    usage_status: "empty",
    facade: "Guney Bati",
    images: [],
    updated_at: "2026-05-12T11:00:00.000Z",
  } satisfies ApiListingDetail;

  assert.deepEqual(getListingDetailFeatureRows(detail), [
    { label: "İlan Tipi", value: "Kiralık" },
    { label: "Şehir", value: "Istanbul" },
    { label: "İlçe", value: "Kadikoy" },
    { label: "Oda Sayısı", value: 3 },
    { label: "Banyo Sayısı", value: 2 },
    { label: "Brüt Alan", value: "120.50 m²" },
    { label: "Eşyalı", value: "Evet" },
    { label: "Isıtma", value: "Merkezi Sistem" },
    { label: "Yakıt", value: "Doğalgaz" },
    { label: "Balkon", value: 2 },
    { label: "Asansör", value: "Var" },
    { label: "Otopark", value: "Açık Otopark" },
    { label: "Site İçinde", value: "Hayır" },
    { label: "Bina Yaşı", value: 5 },
    { label: "Kat Sayısı", value: 12 },
    { label: "Bulunduğu Kat", value: "3. Kat" },
    { label: "Kullanım Durumu", value: "Boş" },
    { label: "Cephe", value: "Guney Bati" },
  ]);

  assert.deepEqual(
    getListingDetailFeatureRows({
      ...detail,
      heating_type: null,
      fuel_type: null,
      balcony_count: null,
      has_elevator: null,
      parking_type: null,
      in_site: null,
      building_age: null,
      floor_count: null,
      floor_number: null,
      usage_status: null,
      facade: null,
    }).map((row) => row.label),
    ["İlan Tipi", "Şehir", "İlçe", "Oda Sayısı", "Banyo Sayısı", "Brüt Alan", "Eşyalı"],
  );
});

test("listing mapper hides non-real seed image URLs behind the local placeholder", () => {
  assert.equal(
    getListingPrimaryImage({ primary_image_url: "https://example.com/phase5-active.jpg" }),
    "/property-nextjs-pro/placeholder-property.jpg",
  );

  assert.deepEqual(
    getListingDetailImages({
      ...rentListing,
      description: "Detayli aciklama",
      heating_type: null,
      fuel_type: null,
      balcony_count: null,
      has_elevator: null,
      parking_type: null,
      in_site: null,
      building_age: null,
      floor_count: null,
      floor_number: null,
      usage_status: null,
      facade: null,
      images: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          image_url: "https://example.com/rent1.jpg",
          alt_text: "Seed placeholder",
          sort_order: 0,
          is_primary: true,
        },
      ],
      updated_at: "2026-05-12T11:00:00.000Z",
    }),
    [
      {
        id: "fallback",
        src: "/property-nextjs-pro/placeholder-property.jpg",
        alt: rentListing.title,
        isPrimary: true,
      },
    ],
  );
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

test("sale listing detail exposes guest sale lead and separate login-gated chat surfaces", () => {
  const pageSource = readFileSync(
    resolve("app/(site)/listings/[id]/page.tsx"),
    "utf8",
  );
  const actionBoxSource = readFileSync(
    resolve("components/sale/sale-lead-preview-box.tsx"),
    "utf8",
  );
  const formSource = readFileSync(
    resolve("components/sale/sale-lead-form.tsx"),
    "utf8",
  );
  const rentActionSource = readFileSync(
    resolve("components/rent/rent-payment-preview-box.tsx"),
    "utf8",
  );

  assert.doesNotMatch(pageSource, /import\s+\{\s*SaleLeadForm\s*\}/);
  assert.match(pageSource, /listing\.type\s*===\s*"rent"[\s\S]*<ListingContactBox/);
  assert.match(pageSource, /\)\s*:\s*\([\s\S]*<ListingContactBox/);
  assert.doesNotMatch(pageSource, /listing\.type\s*===\s*"sale"[\s\S]*<SaleLeadForm/);
  assert.doesNotMatch(rentActionSource, /SaleLeadForm|sale-lead-form/);

  assert.match(actionBoxSource, /import\s+\{\s*SaleLeadForm\s*\}/);
  assert.match(actionBoxSource, /data-aos="fade-up"/);
  assert.match(actionBoxSource, /data-aos-delay="100"/);
  assert.match(actionBoxSource, /<SaleLeadForm\s+listing=\{listing\}/);
  assert.doesNotMatch(actionBoxSource, /href="#sale-lead-form"|href="#listing-contact"/);
  assert.doesNotMatch(actionBoxSource, /getLoginRedirectUrl|Giri[sş] Yap/);

  assert.match(formSource, /id="sale-lead-form"/);
  assert.doesNotMatch(formSource, /rounded-xl[\s\S]*bg-white[\s\S]*p-8/);
  assert.match(formSource, /createSaleLead/);
  assert.match(formSource, /useEffect\s*\(/);
  assert.match(formSource, /disabled=\{\s*!isHydrated\s*\|\|\s*isSubmitting\s*\}/);
  assert.match(formSource, /contactEmail[\s\S]*contactPhone|contactPhone[\s\S]*contactEmail/);
  assert.match(formSource, /!\s*(?:input\.)?contactEmail\s*&&\s*!\s*(?:input\.)?contactPhone/);
  assert.doesNotMatch(formSource, /getLoginRedirectUrl|\/auth\/login|if\s*\(\s*!isAuthenticated\s*\)/);
});

test("listing contact box is login-aware and opens the listing chat panel for authenticated users", () => {
  const source = readFileSync(
    resolve("components/listings/listing-contact-box.tsx"),
    "utf8",
  );

  assert.match(source, /"use client";/);
  assert.match(source, /import\s+\{\s*ListingChatPanel\s*\}/);
  assert.match(source, /useState\s*\(/);
  assert.match(source, /Bu ilanla ilgili mesajla[sÅş]mak i[çc]in giri[sÅş] yapman[ıi]z gerekir/);
  assert.match(source, /Giri[sÅş] Yap ve Mesaj G[öo]nder/);
  assert.match(source, /getLoginRedirectUrl\(`\/listings\/\$\{listingId\}`\)/);
  assert.match(source, /Bu ilanla ilgili sorular[ıi]n[ıi]z[ıi] ofisimize iletebilirsiniz/);
  assert.match(source, /Mesaj G[öo]nder/);
  assert.match(source, /setChatOpen\(true\)/);
  assert.doesNotMatch(source, /disabled[\s\S]*Mesaj G[öo]nder/);
  assert.doesNotMatch(source, /Mesajla[sÅş]ma [öo]zelli[gğ]i sonraki ad[ıi]mda eklenecek/);
});

test("listing chat panel opens conversation on dialog load without sending an automatic initial message", () => {
  const source = readFileSync(
    resolve("components/chat/listing-chat-panel.tsx"),
    "utf8",
  );

  assert.match(source, /getListingConversation/);
  assert.match(source, /createListingConversation/);
  assert.match(source, /getConversationMessages/);
  assert.match(source, /sendConversationMessage/);
  assert.match(source, /İlan Mesajlaşması|Ilan Mesajlasmasi/);
  assert.match(source, /Bu ilanla ilgili sorularınızı ekibimize iletebilirsiniz|Bu ilanla ilgili sorularinizi ekibimize iletebilirsiniz/);
  assert.match(source, /placeholder="Mesajınızı yazın\.\.\."|placeholder="Mesajinizi yazin\.\.\."/);
  assert.match(source, /const MAX_MESSAGE_LENGTH = 2000;/);
  assert.match(source, /maxLength=\{MAX_MESSAGE_LENGTH\}/);
  assert.match(source, /Mesajlaşma başlatılırken bir sorun oluştu\. Lütfen tekrar deneyin\.|Mesajlasma baslatilirken bir sorun olustu\. Lutfen tekrar deneyin\./);
  assert.match(source, /Mesaj gönderilemedi\. Lütfen tekrar deneyin\.|Mesaj gonderilemedi\. Lutfen tekrar deneyin\./);
  assert.doesNotMatch(source, /DEFAULT_INITIAL_MESSAGE|initialMessage|initial_message/);
  assert.doesNotMatch(source, /Mesajla[sÅş]may[ıi] Ba[sÅş]lat/);
});

test("listing detail action components receive auth state from the page boundary", () => {
  const actionBoxSource = readFileSync(
    resolve("components/listings/listing-action-box.tsx"),
    "utf8",
  );
  const contactBoxSource = readFileSync(
    resolve("components/listings/listing-contact-box.tsx"),
    "utf8",
  );
  const pageSource = readFileSync(
    resolve("app/(site)/listings/[id]/page.tsx"),
    "utf8",
  );

  for (const source of [actionBoxSource, contactBoxSource]) {
    assert.match(source, /isAuthenticated\s*:\s*boolean/);
    assert.doesNotMatch(source, /@\/lib\/supabase\/server/);
    assert.doesNotMatch(source, /createClient\s*\(/);
    assert.doesNotMatch(source, /\.auth\.getUser\s*\(/);
  }

  assert.match(pageSource, /cache\s*\(/);
  assert.match(pageSource, /ListingActionBox\s*\(\s*\{[^}]*isAuthenticated/s);
  assert.match(pageSource, /<ListingContactBox[^>]*isAuthenticated=/s);
});

test("public listings page and filters keep Turkish listing copy", () => {
  const pageSource = readFileSync(
    resolve("app/(site)/listings/page.tsx"),
    "utf8",
  );
  const filtersSource = readFileSync(
    resolve("components/listings/listing-filters.tsx"),
    "utf8",
  );
  const resultsSource = readFileSync(
    resolve("components/listings/listing-results.tsx"),
    "utf8",
  );

  for (const source of [pageSource, filtersSource, resultsSource]) {
    assert.doesNotMatch(source, /Properties List|Property List|Properties Found|Advanced Search|Find Property|Sort by Title/);
  }

  assert.match(pageSource, /İlanlar/);
  assert.match(pageSource, /Ana Sayfa/);
  assert.match(resultsSource, /Sıralama/);
  assert.match(filtersSource, /Gelişmiş Filtre/);
  assert.match(filtersSource, /İlanları Bul/);
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
