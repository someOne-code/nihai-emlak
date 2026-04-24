import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const DOC_PATH = path.resolve(process.cwd(), "docs/READ_MODEL_CONTRACT.md");

test("read model contract dokumani kritik endpoint ve hata semantiklerini tanimlar", async () => {
  const content = await readFile(DOC_PATH, "utf8");

  assert.match(content, /^#\s+Faz 5 Read Model Contract/m);
  assert.match(content, /GET\s+\/api\/public\/listings/i);
  assert.match(content, /GET\s+\/api\/public\/listings\/:listingId/i);
  assert.match(content, /GET\s+\/api\/public\/listings\/:listingId\/services/i);
  assert.match(content, /GET\s+\/api\/admin\/read\/reservations/i);
  assert.match(content, /GET\s+\/api\/admin\/read\/orders/i);
  assert.match(content, /GET\s+\/api\/admin\/read\/payments/i);
  assert.match(content, /GET\s+\/api\/admin\/read\/payment-events/i);

  assert.match(content, /list_public_listings/i);
  assert.match(content, /get_public_listing_detail/i);
  assert.match(content, /list_public_listing_services/i);
  assert.match(content, /list_admin_reservations/i);
  assert.match(content, /list_admin_orders/i);
  assert.match(content, /list_admin_payments/i);
  assert.match(content, /list_admin_payment_events/i);

  assert.match(content, /401[\s\S]*Authentication required/i);
  assert.match(content, /403[\s\S]*Admin role required/i);
  assert.match(content, /404[\s\S]*Listing not found/i);
  assert.match(content, /cache-control[\s\S]*no-store/i);
  assert.match(content, /limit[\s\S]*1\.\.100/i);
  assert.match(content, /offset[\s\S]*>=\s*0/i);
  assert.match(content, /address_line[\s\S]*bulunmaz/i);
  assert.match(content, /payment_events[\s\S]*admin_workflow_events[\s\S]*dogrudan client read surface'i degildir/i);
});
