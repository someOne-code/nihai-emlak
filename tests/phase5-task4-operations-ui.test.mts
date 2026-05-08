import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AdminOperationsActionValidationError,
  executeOperationsAction,
  loadOperationsModel,
} from "../lib/admin-ui/operations-controller.ts";

test("task 4 operations view re-arms mounted guard after React strict-mode cleanup", async () => {
  const source = await readFile(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /useEffect\(\(\)\s*=>\s*\{\s*mountedRef\.current\s*=\s*true;/,
    "OperationsView must set mountedRef.current=true in effect setup so dev StrictMode cleanup does not leave the loader stuck",
  );
});

test("task 4 operations view uses readable base text on Payload admin light background", async () => {
  const cssSource = await readFile(
    new URL("../app/(site)/operations.css", import.meta.url),
    "utf8",
  );
  const layoutSource = await readFile(
    new URL("../app/(site)/layout.tsx", import.meta.url),
    "utf8",
  );
  const containerStyle = cssSource.match(/\.opsContainer\s*\{[\s\S]*?\n\}/)?.[0] ?? "";

  assert.match(layoutSource, /import "\.\/operations\.css";/);
  assert.match(
    containerStyle,
    /color:\s*#111827/,
    "OperationsView base text must be dark enough to read on Payload Admin's light page background",
  );
  assert.doesNotMatch(
    containerStyle,
    /color:\s*#e5e7eb/,
    "OperationsView must not use near-white base text on a white admin page",
  );
});

test("task 4 operations view avoids inline styles blocked by Payload admin CSP", async () => {
  const source = await readFile(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /style=\{/);
  assert.doesNotMatch(source, /React\.CSSProperties/);
});

test("task 4 operations view uses a mobile card layout instead of relying only on horizontal table scroll", async () => {
  const source = await readFile(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );
  const cssSource = await readFile(
    new URL("../app/(site)/operations.css", import.meta.url),
    "utf8",
  );

  assert.match(source, /styles\.mobileList/);
  assert.match(source, /styles\.mobileCard/);
  assert.match(cssSource, /\.opsMobileList\s*\{/);
  assert.match(cssSource, /\.opsMobileCard\s*\{/);
  assert.match(cssSource, /@media\s*\(max-width:\s*760px\)/);
  assert.match(
    cssSource,
    /@media\s*\(max-width:\s*760px\)\s*\{[\s\S]*?\.opsTableWrapper\s*\{[\s\S]*?display:\s*none;/,
    "mobile breakpoint should hide the dense desktop table",
  );
  assert.match(
    cssSource,
    /@media\s*\(max-width:\s*760px\)\s*\{[\s\S]*?\.opsMobileList\s*\{[\s\S]*?display:\s*grid;/,
    "mobile breakpoint should enable the card list layout",
  );
});

test("task 4 operations view uses a light admin-compatible palette and readable copy", async () => {
  const source = await readFile(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );
  const cssSource = await readFile(
    new URL("../app/(site)/operations.css", import.meta.url),
    "utf8",
  );

  assert.match(cssSource, /--ops-surface:\s*#/);
  assert.match(cssSource, /--ops-border:\s*#/);
  assert.match(
    cssSource,
    /\.opsTableWrapper,\s*\.opsSnapshotCard,\s*\.opsActionsSection\s*\{[\s\S]*?background:\s*var\(--ops-surface\)/,
  );
  assert.doesNotMatch(
    cssSource,
    /\.opsSnapshotCard,\s*\.opsActionsSection[\s\S]*?background:\s*#111827/,
    "snapshot and action panels should not use harsh near-black surfaces inside Payload admin",
  );
  assert.doesNotMatch(
    source,
    /[ÃÅÄ]/,
    "OperationsView copy should not contain mojibake characters",
  );
});

test("task 4 operations view exposes Turkish pricing breakdown labels for selected reservation", async () => {
  const source = await readFile(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Fiyat Kirilimi/);
  assert.match(source, /Ana Kalemler/);
  assert.match(source, /Ek Hizmetler/);
  assert.match(source, /Toplam Tutar/);
});

test("task 4 operations view replaces raw snapshot dump with curated decision sections", async () => {
  const source = await readFile(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Rezervasyon Bilgileri/);
  assert.match(source, /Iletisim Bilgileri/);
  assert.match(source, /Ilan Bilgileri/);
  assert.doesNotMatch(
    source,
    /Rezervasyon Ozeti/,
    "raw nested snapshot dump heading must not appear in the curated admin view",
  );
  assert.doesNotMatch(
    source,
    /Ilan Ozeti/,
    "raw nested listing snapshot dump heading must not appear in the curated admin view",
  );
});

test("task 4 operations view collapses technical identifiers behind an advanced details disclosure", async () => {
  const source = await readFile(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Gelismis detaylar/);
  assert.match(source, /<details/);
});

test("task 4 operations view uses dedicated decision-summary classes instead of generic snapshot cards", async () => {
  const source = await readFile(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );
  const cssSource = await readFile(
    new URL("../app/(site)/operations.css", import.meta.url),
    "utf8",
  );

  assert.match(source, /decisionGrid:\s*"opsDecisionGrid"/);
  assert.match(source, /summaryCard:\s*"opsSummaryCard"/);
  assert.match(source, /summaryHeader:\s*"opsSummaryHeader"/);
  assert.match(source, /summaryList:\s*"opsSummaryList"/);
  assert.match(source, /summaryItem:\s*"opsSummaryItem"/);
  assert.match(source, /summaryValueStrong:\s*"opsSummaryValueStrong"/);
  assert.match(cssSource, /\.opsDecisionGrid\s*\{/);
  assert.match(cssSource, /\.opsSummaryCard\s*\{/);
  assert.match(cssSource, /\.opsAdvancedDetails\s*\{/);
  assert.match(cssSource, /@media\s*\(max-width:\s*900px\)\s*\{[\s\S]*?\.opsDecisionGrid\s*\{[\s\S]*?grid-template-columns:\s*1fr;/);
});

test("task 4 operations view formats stay months and guest count in human-readable Turkish phrases", async () => {
  const source = await readFile(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /\$\{[a-zA-Z_]+\}\s*ay/);
  assert.match(source, /\$\{[a-zA-Z_]+\}\s*kisi/);
});

test("task 4 operations view renders disabled action reasons as visible helper text", async () => {
  const source = await readFile(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );
  const cssSource = await readFile(
    new URL("../app/(site)/operations.css", import.meta.url),
    "utf8",
  );

  assert.match(source, /actionReason:\s*"opsActionReason"/);
  assert.match(source, /disabled && action\.disabledReason && !pending/);
  assert.match(cssSource, /\.opsActionReason\s*\{/);
});

test("task 4 operations view localizes workflow conflict errors for admins", async () => {
  const source = await readFile(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Bu islem mevcut kayit durumunda yapilamaz/);
  assert.doesNotMatch(
    source,
    /if \(err instanceof AdminOperationsClientError\) return err\.message;/,
    "raw backend workflow errors should not be surfaced directly in the operations page",
  );
});

test("task 4 loader fetches overview, selected reservation snapshot, and related listing snapshot", async () => {
  const calls: string[] = [];
  const model = await loadOperationsModel({
    fetchListingWorkflowSnapshot: async (listingId) => {
      calls.push(`listing:${listingId}`);
      return {
        listing: { id: listingId, status: "passive" },
        eligibility: { can_reopen: true },
      };
    },
    fetchReservationWorkflowSnapshot: async (reservationId) => {
      calls.push(`reservation:${reservationId}`);
      return {
        reservation: { id: reservationId, status: "pending" },
        listing: { id: "listing-1", status: "passive" },
        eligibility: { can_cancel: true, can_confirm: true },
      };
    },
    loadAdminOperationsOverview: async () => {
      calls.push("overview");
      return createOverview();
    },
    loadAdminPaymentEvents: async () => ({ items: [], limit: 20, offset: 0 }),
  });

  assert.deepEqual(calls, ["overview", "reservation:reservation-1", "listing:listing-1"]);
  assert.equal(model.selectedReservationId, "reservation-1");
  assert.equal(model.selectedListingId, "listing-1");
  assert.deepEqual(model.actions.map((action) => [action.id, action.enabled]), [
    ["cancel", true],
    ["confirm", true],
    ["reopen", true],
  ]);
});

test("task 4 action executor rejects missing reason before cancel or reopen workflow calls", async () => {
  const calls: string[] = [];
  const dependencies = {
    cancelReservationWorkflow: async () => {
      calls.push("cancel");
      return {};
    },
    confirmReservationWorkflow: async () => {
      calls.push("confirm");
      return {};
    },
    reopenListingWorkflow: async () => {
      calls.push("reopen");
      return {};
    },
  };

  await assert.rejects(
    () =>
      executeOperationsAction(dependencies, {
        actionId: "cancel",
        reasonText: "   ",
        noteText: "ignored",
        selectedListingId: "listing-1",
        selectedReservationId: "reservation-1",
      }),
    AdminOperationsActionValidationError,
  );
  await assert.rejects(
    () =>
      executeOperationsAction(dependencies, {
        actionId: "reopen",
        reasonText: "",
        noteText: "ignored",
        selectedListingId: "listing-1",
        selectedReservationId: "reservation-1",
      }),
    AdminOperationsActionValidationError,
  );

  assert.deepEqual(calls, []);
});

test("task 4 action executor normalizes workflow payloads and returns refresh target", async () => {
  const calls: unknown[] = [];
  const dependencies = {
    cancelReservationWorkflow: async (reservationId: string, body: { reason: string; note?: string | null }) => {
      calls.push(["cancel", reservationId, body]);
      return {};
    },
    confirmReservationWorkflow: async (reservationId: string, body: { note?: string | null }) => {
      calls.push(["confirm", reservationId, body]);
      return {};
    },
    reopenListingWorkflow: async (listingId: string, body: { reason: string; note?: string | null }) => {
      calls.push(["reopen", listingId, body]);
      return {};
    },
  };

  const cancelResult = await executeOperationsAction(dependencies, {
    actionId: "cancel",
    reasonText: " customer_withdrew ",
    noteText: "  changed plans ",
    selectedListingId: "listing-1",
    selectedReservationId: "reservation-1",
  });
  const confirmResult = await executeOperationsAction(dependencies, {
    actionId: "confirm",
    reasonText: "",
    noteText: "   ",
    selectedListingId: "listing-1",
    selectedReservationId: "reservation-1",
  });
  const reopenResult = await executeOperationsAction(dependencies, {
    actionId: "reopen",
    reasonText: " reservation_cancelled ",
    noteText: "",
    selectedListingId: "listing-1",
    selectedReservationId: "reservation-1",
  });

  assert.deepEqual(calls, [
    ["cancel", "reservation-1", { reason: "customer_withdrew", note: "changed plans" }],
    ["confirm", "reservation-1", { note: null }],
    ["reopen", "listing-1", { reason: "reservation_cancelled", note: null }],
  ]);
  assert.deepEqual([cancelResult, confirmResult, reopenResult], [
    { message: "Islem basariyla tamamlandi: cancel", refreshReservationId: "reservation-1" },
    { message: "Islem basariyla tamamlandi: confirm", refreshReservationId: "reservation-1" },
    { message: "Islem basariyla tamamlandi: reopen", refreshReservationId: "reservation-1" },
  ]);
});

function createOverview() {
  return {
    orders: {
      items: [{ id: "order-1", reservation_id: "reservation-1", status: "pending" }],
      limit: 100,
      offset: 0,
    },
    payments: {
      items: [{ id: "payment-1", order_id: "order-1", status: "succeeded" }],
      limit: 100,
      offset: 0,
    },
    reservations: {
      items: [
        {
          id: "reservation-1",
          listing_id: "listing-1",
          listing: { id: "listing-1", title: "Kadikoy 2+1", status: "passive" },
          status: "pending",
        },
      ],
      limit: 20,
      offset: 0,
    },
  };
}
