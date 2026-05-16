import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("public consultants route renders the public chrome and published consultants surface", () => {
  const page = readProjectFile("app/(site)/consultants/page.tsx");

  assert.match(page, /import \{ PublicHeader \} from "@\/components\/site\/public-header";/);
  assert.match(page, /import \{ PublicFooter \} from "@\/components\/site\/public-footer";/);
  assert.match(page, /import \{ ConsultantCard \} from "@\/components\/consultants\/consultant-card";/);
  assert.match(page, /import \{ listPublishedConsultants \} from "@\/lib\/api\/consultants";/);
  assert.match(page, /const consultants = await listPublishedConsultants\(\);/);
  assert.match(page, /<h1[\s\S]*Danışmanlarımız/);
  assert.match(page, /bg-property-hero/);
  assert.match(page, /bg-property-light/);
  assert.match(page, /consultants\.map/);
  assert.match(page, /<ConsultantCard key=\{consultant\.id\} consultant=\{consultant\} \/>/);
  assert.match(page, /Danışman bilgileri yakında eklenecek\./);
});

test("public consultants API reads published Payload consultants without privileged access", () => {
  const source = readProjectFile("lib/api/consultants.ts");

  assert.match(source, /getPayload/);
  assert.match(source, /collection: "consultants"/);
  assert.match(source, /isPublished: \{ equals: true \}/);
  assert.match(source, /sort: "sortOrder"/);
  assert.match(source, /limit: 100/);
  assert.match(source, /overrideAccess: false/);
  assert.match(source, /mapPayloadConsultantToPublic/);
  assert.doesNotMatch(source, /service_role|overrideAccess: true/);
});

test("public consultant cards show only backend-provided profile fields and no detail links", () => {
  const source = readProjectFile("components/consultants/consultant-card.tsx");

  assert.match(source, /from "next\/image"/);
  assert.match(source, /consultant\.photoUrl/);
  assert.match(source, /consultant\.fullName/);
  assert.match(source, /consultant\.title/);
  assert.match(source, /consultant\.shortBio/);
  assert.match(source, /consultant\.phone/);
  assert.match(source, /consultant\.email/);
  assert.match(source, /consultant\.whatsappUrl/);
  assert.match(source, /consultant\.linkedinUrl/);
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

  assert.doesNotMatch(`${page}\n${card}\n${api}`, /blog_posts|author|byline|avatarUrl|blog author/i);
});
