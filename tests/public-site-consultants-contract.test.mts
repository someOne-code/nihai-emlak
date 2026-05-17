import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

process.env.NODE_ENV = "test";

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("public consultants route renders the public chrome and published consultants surface", () => {
  const page = readProjectFile("app/(site)/consultants/page.tsx");

  assert.match(page, /import \{ PublicHeader \} from "@\/components\/site\/public-header";/);
  assert.match(page, /import \{ PublicFooter \} from "@\/components\/site\/public-footer";/);
  assert.match(page, /import \{ ConsultantCard \} from "@\/components\/consultants\/consultant-card";/);
  assert.match(page, /import \{ listPublishedConsultants \} from "@\/lib\/api\/consultants";/);
  assert.match(page, /import \{ connection \} from "next\/server";/);
  assert.match(page, /await connection\(\);/);
  assert.match(page, /const consultants = await listPublishedConsultants\(\);/);
  assert.match(page, /<h1[\s\S]*Danışmanlarımız/);
  assert.match(page, /bg-property-hero/);
  assert.match(page, /bg-property-light/);
  assert.match(page, /Bölge bilgisi/);
  assert.match(page, /Şeffaf iletişim/);
  assert.match(page, /Satılık ve kiralık süreç desteği/);
  assert.match(page, /grid-cols-1/);
  assert.match(page, /md:grid-cols-2/);
  assert.match(page, /xl:grid-cols-3/);
  assert.match(page, /2xl:grid-cols-4/);
  assert.match(page, /consultants\.map/);
  assert.match(page, /<ConsultantCard key=\{consultant\.id\} consultant=\{consultant\} \/>/);
  assert.match(page, /Danışman bilgileri yakında eklenecek\./);
  assert.match(page, /href="\/listings"/);
});

test("public consultants API reads published Payload consultants without privileged access", () => {
  const source = readProjectFile("lib/api/consultants.ts");

  assert.match(source, /getPayload/);
  assert.match(source, /collection: "consultants"/);
  assert.match(source, /isPublished: \{ equals: true \}/);
  assert.match(source, /sort: "sortOrder"/);
  assert.match(source, /limit: 100/);
  assert.match(source, /overrideAccess: false/);
  assert.match(source, /isPublished: true/);
  assert.match(source, /sortOrder: true/);
  assert.match(source, /mapPayloadConsultantToPublic/);
  assert.match(source, /mapPublishedPayloadConsultantsForTest/);
  assert.doesNotMatch(source, /service_role|overrideAccess: true/);
});

test("public consultants API has development fallback profiles without exposing passive rows", () => {
  const source = readProjectFile("lib/api/consultants.ts");

  assert.match(source, /from "node:net"/);
  assert.match(source, /DEV_FALLBACK_CONSULTANTS/);
  assert.match(source, /shouldUseDevFallbackConsultants/);
  assert.match(source, /canReachLocalPayloadDatabase/);
  assert.match(source, /process\.env\.NODE_ENV !== "production"/);
  assert.match(source, /Elif Yilmaz/);
  assert.match(source, /Murat Arslan/);
  assert.doesNotMatch(source, /Pasif Danisman/);
});

test("public consultant mapper filters passive rows and sorts by order then name", async () => {
  const { mapPublishedPayloadConsultantsForTest } = await import("../lib/api/consultants.ts");

  const consultants = mapPublishedPayloadConsultantsForTest(
    [
      {
        id: 1,
        fullName: "Zeynep Aktas",
        slug: "zeynep-aktas",
        title: "Kiralama Danismani",
        photoUrl: "https://example.com/person.jpg",
        isPublished: true,
        sortOrder: 2,
      },
      {
        id: 2,
        fullName: "Pasif Danisman",
        slug: "pasif-danisman",
        isPublished: false,
        sortOrder: 0,
      },
      {
        id: 3,
        fullName: "Ayse Kaya",
        slug: "ayse-kaya",
        photoUrl: "/property-nextjs-pro/images/hero/hero-profile-1.jpg",
        isPublished: true,
        sortOrder: 2,
      },
      {
        id: 4,
        fullName: "Mehmet Demir",
        slug: "mehmet-demir",
        isPublished: true,
        sortOrder: 1,
      },
    ],
    { supabasePublicUrl: "https://project.supabase.co" },
  );

  assert.deepEqual(
    consultants.map((consultant) => consultant.fullName),
    ["Mehmet Demir", "Ayse Kaya", "Zeynep Aktas"],
  );
  assert.equal(consultants.some((consultant) => consultant.fullName === "Pasif Danisman"), false);
  assert.equal(consultants.find((consultant) => consultant.fullName === "Zeynep Aktas")?.photoUrl, null);
  assert.equal(
    consultants.find((consultant) => consultant.fullName === "Ayse Kaya")?.photoUrl,
    "/property-nextjs-pro/images/hero/hero-profile-1.jpg",
  );
  assert.doesNotMatch(JSON.stringify(consultants), /isPublished|sortOrder|createdAt|updatedAt/);
});

test("public consultant cards show only backend-provided profile fields and no detail links", () => {
  const source = readProjectFile("components/consultants/consultant-card.tsx");

  assert.match(source, /from "next\/image"/);
  assert.match(source, /rounded-2xl/);
  assert.match(source, /hover:-translate-y-1/);
  assert.match(source, /shadow-\[0_18px_50px_rgba/);
  assert.match(source, /aspect-square/);
  assert.match(source, /object-contain/);
  assert.match(source, /consultant\.phone \?/);
  assert.match(source, /consultant\.email \?/);
  assert.match(source, /consultant\.whatsappUrl \?/);
  assert.match(source, /consultant\.linkedinUrl \?/);
  assert.match(source, /consultant\.photoUrl/);
  assert.match(source, /consultant\.fullName/);
  assert.match(source, /consultant\.title/);
  assert.match(source, /consultant\.shortBio/);
  assert.match(source, /consultant\.phone/);
  assert.match(source, /consultant\.email/);
  assert.match(source, /consultant\.whatsappUrl/);
  assert.match(source, /consultant\.linkedinUrl/);
  assert.match(source, /tel:\$\{consultant\.phone\.replace/);
  assert.match(source, /mailto:\$\{consultant\.email\}/);
  assert.match(source, /target=\{external \? "_blank" : undefined\}/);
  assert.match(source, /rel=\{external \? "noreferrer" : undefined\}/);
  assert.doesNotMatch(source, /from "next\/link"|href=\{`\/consultants\/|href=\{["']\/consultants/);
  assert.doesNotMatch(source, /fake|placeholder phone|555 00 00|example@/i);
});

test("public consultants model exposes only public profile fields", () => {
  const source = readProjectFile("types/consultant.ts");

  for (const field of [
    "id",
    "fullName",
    "slug",
    "title",
    "photoUrl",
    "shortBio",
    "phone",
    "email",
    "whatsappUrl",
    "linkedinUrl",
  ]) {
    assert.match(source, new RegExp(`${field}:`));
  }

  assert.doesNotMatch(source, /isPublished|sortOrder|createdAt|updatedAt|role|admin/i);
});

test("consultants surface stays separate from blog author or byline behavior", () => {
  const page = readProjectFile("app/(site)/consultants/page.tsx");
  const card = readProjectFile("components/consultants/consultant-card.tsx");
  const api = readProjectFile("lib/api/consultants.ts");
  const header = readProjectFile("components/site/public-header.tsx");

  assert.doesNotMatch(`${page}\n${card}\n${api}`, /blog_posts|author|byline|avatarUrl|blog author/i);
  assert.match(header, /href: "\/consultants"/);
});

test("local Supabase seed includes published and passive Payload consultant examples", () => {
  const seed = readProjectFile("supabase/seed.sql");

  assert.match(seed, /payload\.consultants/);
  assert.match(seed, /elif-yilmaz/);
  assert.match(seed, /murat-arslan/);
  assert.match(seed, /pasif-danisman/);
  assert.match(seed, /true,\s*0/);
  assert.match(seed, /false,\s*99/);
  assert.match(seed, /ON CONFLICT \(slug\) DO UPDATE/);
});
