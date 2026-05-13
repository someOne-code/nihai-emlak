import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "..");

test("admin listings renders checkout readiness in a single detail surface", () => {
  const source = readFileSync(
    resolve(repoRoot, "components/admin-listings/AdminListingsView.tsx"),
    "utf8",
  );

  const checkoutPanelRenders = source.match(/<CheckoutReadinessPanel\b/g) ?? [];

  assert.equal(
    checkoutPanelRenders.length,
    1,
    "Checkout readiness must not be duplicated as both a tab panel and an extra side panel.",
  );
  assert.match(source, /variant="tab"/);
  assert.doesNotMatch(source, /variant="side"/);
});

test("services panel gates on enabled main item before allowing service config", () => {
  const source = readFileSync(
    resolve(repoRoot, "components/admin-listings/ListingServicesPanel.tsx"),
    "utf8",
  );

  // The panel must check for an enabled main item and show a locked message.
  assert.match(
    source,
    /hasEnabledMainItem/,
    "ListingServicesPanel must check for an enabled main item before allowing service configuration.",
  );
  assert.match(
    source,
    /Ana Ödeme Kalemleri/,
    "ListingServicesPanel must reference the main items tab when locked.",
  );
});

test("admin listings product shell uses the current two-surface layout", () => {
  const css = readFileSync(
    resolve(repoRoot, "app/(site)/admin/listings/listings.css"),
    "utf8",
  );

  assert.match(
    css,
    /grid-template-columns:\s*minmax\(240px,\s*320px\)\s+minmax\(0,\s*1fr\);/,
    "The listings shell should define only the list and detail columns.",
  );
  assert.match(
    css,
    /\.lstProductShell\s*>\s*\*\s*{\s*min-width:\s*0;/s,
    "Grid children must be allowed to shrink instead of forcing panel overlap.",
  );
  assert.doesNotMatch(
    css,
    /aside:last-child/,
    "The stale third checkout side panel layout rule must not remain.",
  );
});

test("admin listings general save reuses mutation snapshot without detail refetch", () => {
  const source = readFileSync(
    resolve(repoRoot, "components/admin-listings/AdminListingsView.tsx"),
    "utf8",
  );

  assert.match(source, /refreshAdminListingsModelAfterMutation/);
  assert.match(source, /const snapshot = await updateAdminListing\(listingId, payload\)/);
  assert.match(source, /return \{ listingId, snapshot, reuseList: true \};/);
});

test("admin listings ignores stale list load responses", () => {
  const source = readFileSync(
    resolve(repoRoot, "components/admin-listings/AdminListingsView.tsx"),
    "utf8",
  );

  assert.match(
    source,
    /loadRequestSeqRef = useRef\(0\)/,
    "List loads must keep a monotonic request sequence.",
  );
  assert.match(
    source,
    /const requestSeq = loadRequestSeqRef\.current \+ 1;/,
    "Each list load must capture its own request sequence.",
  );
  assert.match(
    source,
    /loadRequestSeqRef\.current !== requestSeq/,
    "Older list load responses must be ignored before mutating state.",
  );
});

test("listing images panel stores the canonical upload url in the legacy add-image payload", () => {
  const source = readFileSync(
    resolve(repoRoot, "components/admin-listings/ListingImagesPanel.tsx"),
    "utf8",
  );

  assert.match(
    source,
    /image_url:\s*resolveListingImageUploadUrl\(result\)/,
    "ListingImagesPanel must keep the add-image payload legacy-compatible while choosing the best upload URL.",
  );
});

test("listing images panel defaults the first upload to primary cover", () => {
  const source = readFileSync(
    resolve(repoRoot, "components/admin-listings/ListingImagesPanel.tsx"),
    "utf8",
  );

  assert.match(
    source,
    /<ImageUploadBox\b[^>]*hasExistingImages=\{images\.length > 0\}/s,
    "ListingImagesPanel must tell the upload box whether the listing already has images.",
  );
  assert.match(
    source,
    /useState\(!hasExistingImages\)/,
    "The upload box should default the first image to primary without forcing later uploads primary.",
  );
});

test("listing images panel helper copy explains optimized upload and cover quality rules", () => {
  const source = readFileSync(
    resolve(repoRoot, "components/admin-listings/ListingImagesPanel.tsx"),
    "utf8",
  );

  assert.match(source, /optimize/i);
  assert.match(source, /kapak/i);
  assert.match(source, /WebP/);
});
