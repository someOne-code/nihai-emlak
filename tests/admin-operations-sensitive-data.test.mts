import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import { buildOperationsTimelineEntries } from "../lib/admin-ui/operations-timeline.ts";
import { buildOperationsViewModel } from "../lib/admin-ui/operations-view-model.ts";

test("operations summary cards keep long contact values inside the card", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsSnapshotCards.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /grid-cols-\[minmax\(72px,0\.4fr\)_minmax\(0,1fr\)\]/,
    "summary card rows must allow the value column to shrink inside narrow cards",
  );
  assert.match(
    source,
    /<dd className="min-w-0 break-words \[overflow-wrap:anywhere\] font-semibold">/,
    "long values such as email addresses must wrap before overflowing the card",
  );
});

test("admin operations components do not ship escaped Turkish text", () => {
  const componentDir = new URL("../components/admin-operations/", import.meta.url);
  const files = readdirSync(componentDir)
    .filter((file) => file.endsWith(".tsx"))
    .map((file) => ({
      file,
      source: readFileSync(new URL(file, componentDir), "utf8"),
    }));

  for (const { file, source } of files) {
    assert.doesNotMatch(
      source,
      /\\u[0-9a-fA-F]{4}/,
      `${file} contains a literal Unicode escape that can render as \\uXXXX in JSX text`,
    );
  }
});

test("document action buttons do not make completion look preselected", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsDocumentTrackingCard.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(
    source,
    /action\.status === "completed"\s*\?\s*"default"/,
    "Belgeler tamamlandı must not use the primary/default button style unless the admin actually clicks it",
  );
});

test("finance ops card is not rendered when there is no finance work", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /viewModel\.financeOps\?\.hasVisibleWork/,
    "Finance ops card must be gated by real finance work instead of showing a disabled empty card for every reservation",
  );
});

test("finance ops card renders refund request decision buttons and manual refund guidance", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsFinanceOpsCard.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /status: "refund_requested", label: "İptal talebini onayla"/);
  assert.match(source, /status: "deposit_forfeited", label: "İptal talebini reddet"/);
  assert.match(source, /Müşterinin iptal \/ iade talebi alındı/);
  assert.match(source, /Müşteriye ödemeyi gerçek hayatta yaptıktan sonra/);
  assert.match(source, /İadeyi tamamladım/);
  assert.match(
    source,
    /\.filter\(\(action\) => allowedStatuses\.has\(action\.status\)\)/,
    "Finance card should render only actions that belong to the current finance state.",
  );
});

test("finance ops card renders separate payment issue outcomes", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsFinanceOpsCard.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /status: "issue_resolved", label: "Ödeme alındı, devam et"/);
  assert.match(source, /status: "payment_not_received", label: "Ödeme alınmadı, süreci kapat"/);
  assert.match(source, /label: "Kontrol sürüyor"/);
  assert.match(source, /Banka\/muhasebe kontrolü sonucu paranın hesaba geçip geçmediğini seç/);
});

test("document and finance cards show admin display text instead of raw admin UUID", () => {
  const documentSource = readFileSync(
    new URL("../components/admin-operations/OperationsDocumentTrackingCard.tsx", import.meta.url),
    "utf8",
  );
  const financeSource = readFileSync(
    new URL("../components/admin-operations/OperationsFinanceOpsCard.tsx", import.meta.url),
    "utf8",
  );

  assert.match(documentSource, /documentTracking\?\.adminDisplayText \?\? "Admin"/);
  assert.doesNotMatch(documentSource, /documentTracking\?\.lastAdminUserId \?\? "-"/);
  assert.match(financeSource, /financeOps\?\.adminDisplayText \?\? "Admin"/);
  assert.doesNotMatch(financeSource, /financeOps\?\.lastAdminUserId \?\? "-"/);
});

test("operations view handles refund request approval through cancellation workflow", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /handleRefundRequestApprove/);
  assert.match(source, /actionId:\s*"cancel"/);
  assert.match(source, /refundDecision:\s*"manual_refund"/);
  assert.match(
    source,
    /viewModel\.financeOps\?\.allowedStatuses\.length \?\? 0/,
    "Generic reservation actions should be hidden while a finance queue has its own active actions.",
  );
  assert.match(
    source,
    /queue:\s*"manual_refunds"/,
    "Talep onaylanınca kayıt iptal/iade filtresinden çıkar; UI manuel iade kuyruğuna geçmelidir.",
  );
});

test("operations view clears stale filters when workflow moves a record to a new queue", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /\{\s*\.\.\.INITIAL_FILTER_STATE,\s*queue:\s*"completed"\s*\}/);
  assert.match(source, /\{\s*\.\.\.INITIAL_FILTER_STATE,\s*queue:\s*"document_waiting"\s*\}/);
  assert.match(source, /\{\s*\.\.\.INITIAL_FILTER_STATE,\s*queue:\s*"all"\s*\}/);
  assert.match(source, /\{\s*\.\.\.INITIAL_FILTER_STATE,\s*queue:\s*"manual_refunds"\s*\}/);
});

test("operations validation errors render under the related admin note field", () => {
  const viewSource = readFileSync(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );
  const financeSource = readFileSync(
    new URL("../components/admin-operations/OperationsFinanceOpsCard.tsx", import.meta.url),
    "utf8",
  );
  const documentSource = readFileSync(
    new URL("../components/admin-operations/OperationsDocumentTrackingCard.tsx", import.meta.url),
    "utf8",
  );
  const actionSource = readFileSync(
    new URL("../components/admin-operations/OperationsActionPanel.tsx", import.meta.url),
    "utf8",
  );

  assert.match(viewSource, /setScopedNoteError\("finance", err\)/);
  assert.match(viewSource, /setScopedNoteError\("document", err\)/);
  assert.match(viewSource, /setScopedNoteError\("action", err\)/);
  assert.match(viewSource, /setFinanceNoteError\(message\)/);
  assert.match(viewSource, /setDocumentNoteError\(message\)/);
  assert.match(viewSource, /setNoteError\(message\)/);

  assert.match(financeSource, /noteError\?: string \| null/);
  assert.match(financeSource, /id="finance-ops-note-error"/);
  assert.match(financeSource, /className="text-sm font-medium text-destructive"/);
  assert.match(documentSource, /id="document-tracking-note-error"/);
  assert.match(actionSource, /id="ops-note-error"/);
});

test("expired deposit refund approval asks for a second confirmation after note is present", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /isExpiredDepositRefundCandidate/);
  assert.match(source, /financeNoteText\.trim\(\)\.length > 0/);
  assert.match(source, /setExpiredDepositConfirmOpen\(true\)/);
  assert.match(source, /Kapora iade süresi dolmuş/);
  assert.match(source, /Evet, manuel iade başlat/);
});

test("operations action panel explains blocked actions with actionable copy", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsActionPanel.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /manuel aksiyon uygulanamıyor/);
  assert.match(source, /Bu kayıtta yapılacak manuel işlem yok/);
  assert.doesNotMatch(source, /Aşağıdaki açıklamalar/);
  assert.match(source, /Sebep:/);
  assert.match(source, /Sonraki adım:/);
  assert.match(
    source,
    /group-hover:block/,
    "Disabled action details should appear on hover instead of rendering as default text under buttons.",
  );
});

test("operations view hides document tracking while finance workflow owns the next step", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /shouldShowDocumentTracking && \(\s*<OperationsDocumentTrackingCard/,
    "Document tracking should be gated by the dedicated document queue instead of competing with refund/payment work.",
  );
});

test("operations view hides generic actions while document workflow owns the next step", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /const hasActiveDocumentActions =\s*!hasActiveFinanceActions && \(viewModel\.documentTracking\?\.allowedStatuses\.length \?\? 0\) > 0;/,
    "Document workflow should be recognized as the active work owner.",
  );
  assert.match(
    source,
    /shouldRenderDetailPanels && !isReservationAlreadyConfirmed && !hasActiveFinanceActions && !hasActiveDocumentActions && viewModel\.actions\.length > 0/,
    "Generic reservation actions should not compete with the document workflow card.",
  );
});

test("operations view hides generic contract actions after reservation is already confirmed", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /const isReservationAlreadyConfirmed = getNestedStatus\(viewModel\.reservationSnapshot, "reservation"\) === "confirmed";/,
    "Confirmed reservations are terminal for this page and should be recognized before rendering action buttons.",
  );
  assert.match(
    source,
    /shouldRenderDetailPanels && !isReservationAlreadyConfirmed && !hasActiveFinanceActions && !hasActiveDocumentActions && viewModel\.actions\.length > 0/,
    "The generic Sözleşmeyi tamamla action panel should not render for a reservation that is already confirmed.",
  );
});

test("all queue row selection routes the record into its own operations queue", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /handleRowSelect = useCallback\(\(row: OperationsOverviewRow\)/);
  assert.match(
    source,
    /currentFilters\.queue === "all" && row\.queue !== "all"/,
    "Clicking from Tümü should move the selected record into its own queue before showing actions.",
  );
  assert.match(source, /queue: row\.queue/);
  assert.doesNotMatch(
    source,
    /onClick=\{\(\) => handleRowSelect\(row\.reservationId\)\}/,
    "Rows should pass the full row so queue context cannot be lost.",
  );
});

test("all queue stays list-only and never renders detail or action panels", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /const isAllQueue = filters\.queue === "all";/,
    "The view should explicitly recognize when Tümü is active.",
  );
  assert.match(
    source,
    /const shouldRenderDetailPanels = !isAllQueue && !!effectiveSelectedReservationId;/,
    "Detail rendering should be centrally gated so Tümü remains list-only.",
  );
  assert.match(
    source,
    /shouldRenderDetailPanels && \(\s*<div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">/,
    "Reservation, listing, and payment summary cards should be hidden in Tümü.",
  );
  assert.match(
    source,
    /shouldRenderDetailPanels && viewModel\.financeOps\?\.hasVisibleWork/,
    "Finance workflow should not render inside Tümü.",
  );
  assert.match(
    source,
    /shouldRenderDetailPanels && !isReservationAlreadyConfirmed && !hasActiveFinanceActions && !hasActiveDocumentActions && viewModel\.actions\.length > 0/,
    "Generic action buttons should not appear in Tümü.",
  );
  assert.doesNotMatch(
    source,
    /\{effectiveSelectedReservationId && \(\s*<div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">/,
    "Raw selected-reservation checks are too loose and allow stale detail panels in Tümü.",
  );
});

test("operations view uses a shadcn-consistent responsive queue shell", () => {
  const viewSource = readFileSync(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );
  const filtersSource = readFileSync(
    new URL("../components/admin-operations/OperationsFilters.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    viewSource,
    /xl:grid-cols-\[minmax\(280px,340px\)_minmax\(0,1fr\)\]/,
    "Desktop operations layout should match the admin product shell pattern: compact queue rail plus flexible detail pane.",
  );
  assert.match(
    viewSource,
    /xl:sticky xl:top-20 xl:max-h-\[calc\(100vh-7rem\)\]/,
    "The queue rail should stay visible on desktop without trapping mobile users in a sticky panel.",
  );
  assert.match(
    viewSource,
    /CardHeader[\s\S]*?Operasyon kuyruğu[\s\S]*?CardContent/,
    "The queue rail should use full shadcn Card composition with a clear list heading.",
  );
  assert.match(
    viewSource,
    /flex flex-col gap-2 overflow-y-auto/,
    "Queue records should render as a vertical card list on every viewport, not only as a mobile fallback.",
  );
  assert.doesNotMatch(
    viewSource,
    /hidden overflow-x-auto md:block/,
    "Desktop operations should not fall back to the old horizontally-scrolled table surface.",
  );
  assert.doesNotMatch(
    viewSource,
    /<Table/,
    "The responsive operations queue should not depend on the dense table component.",
  );
  assert.match(
    filtersSource,
    /rounded-xl border bg-card p-4/,
    "Operations filters should share the same shadcn card-like toolbar treatment used by nearby admin pages.",
  );
});

test("document tracking only renders in the document queue and explains failed action", () => {
  const viewSource = readFileSync(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );
  const documentSource = readFileSync(
    new URL("../components/admin-operations/OperationsDocumentTrackingCard.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    viewSource,
    /const shouldShowDocumentTracking =\s*shouldRenderDetailPanels &&\s*filters\.queue === "document_waiting"/,
    "Document controls should not appear for payment, refund, manual refund, or completed queues.",
  );
  assert.match(documentSource, /description: "Belgeleri eksik veya başarısız olarak işaretler/);
  assert.match(documentSource, /Rezervasyon iptal olmaz ve ilan otomatik yayına alınmaz/);
  assert.match(documentSource, /title=\{description\}/);
});

test("operations detail panel is gated by the filtered visible selection", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /filteredRows\.find\(\(r\)\s*=>\s*r\.reservationId === viewModel\.selectedReservationId\)/,
    "Detail selection must come from visible filtered rows.",
  );
  assert.match(
    source,
    /const effectiveSelectedReservationId = selectedRow\?\.reservationId \?\? null;/,
    "Detail cards need an explicit guard for filtered-empty tabs.",
  );
  assert.doesNotMatch(
    source,
    /\{viewModel\.selectedReservationId && \(\s*<div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">/,
    "Core detail cards must not render from a stale hidden selected reservation.",
  );
});

test("operations view never renders raw auth backend errors", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /handleAdminAuthError/);
  assert.match(source, /Oturumunuz sona erdi/);
  assert.match(source, /admin yetkisi gerekiyor/);
  assert.doesNotMatch(
    source,
    /return String\(err\.message\);/,
    "Raw Authentication required/Admin role required text must not be rendered.",
  );
});

test("operations queue cards use business labels for order and payment states", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /<OperationsStatusBadge status=\{row\.primaryStatus\}/, "The queue card should still show the operation state.");
  assert.match(source, /label="Sipari\u015f kayd\u0131"/, "The order lifecycle label should not be shortened to Sipari\u015f.");
  assert.match(source, /label="Banka \u00f6demesi"/, "The payment lifecycle label should explain that this is the bank payment state.");
  assert.doesNotMatch(source, />Durum</, "The ambiguous Durum column label should not be used in the operations queue.");
});

test("payment summary explains pending order and bank payment states", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsSnapshotCards.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Sipariş kaydı/, "Payment summary should show the order record state.");
  assert.match(source, /Banka ödemesi/, "Payment summary should show the bank payment state.");
  assert.match(
    source,
    /banka henüz başarılı ödeme dönüşü yapmadı/i,
    "Pending payment must explain that a successful bank response has not arrived.",
  );
  assert.match(
    source,
    /ödeme başarılı olmadığı için sipariş kaydı tamamlanmadı/i,
    "Pending order must explain why the order record is still waiting.",
  );
});

test("payment summary still renders when detailed payment items are missing", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsSnapshotCards.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(
    source,
    /if \(!breakdown\) \{\s*return null;\s*\}/,
    "Payment summary must not disappear just because detailed order items are missing.",
  );
  assert.match(
    source,
    /const totalLabel = breakdown\?\.totalLabel/,
    "Payment summary should fall back to order total when line items are missing.",
  );
});

test("operation detail hierarchy starts with reservation listing and payment summary", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );

  const reservationIndex = source.indexOf("<ReservationDetailsCard");
  const listingIndex = source.indexOf("<ListingSummaryCard");
  const paymentIndex = source.indexOf("<PricingBreakdownCard");
  const documentIndex = source.indexOf("<OperationsDocumentTrackingCard");

  assert.ok(reservationIndex > -1, "Reservation information card should be rendered in the detail area.");
  assert.ok(listingIndex > reservationIndex, "Listing information should follow reservation information.");
  assert.ok(paymentIndex > listingIndex, "Payment summary should follow listing information.");
  assert.ok(documentIndex > paymentIndex, "Document tracking should come after the core reservation/listing/payment hierarchy.");
});

test("payment summary shows deposit refund window from payment date", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsSnapshotCards.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /Kapora iade kontrolü/);
  assert.match(source, /getDepositRefundWindowLabel/);
  assert.match(source, /14 günlük kapora iade süresi dolmuş/);
  assert.match(source, /kapora iade hakkı sürüyor/);
});

test("payment summary prefers backend deposit refund window over UI date estimation", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsSnapshotCards.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /financeOps\?\.depositRefundWindow \?\? null/);
  assert.match(source, /backendWindow: OperationsFinanceOpsViewModel\["depositRefundWindow"\] \| null/);
  assert.match(source, /if \(backendWindow\) \{/);
  assert.match(source, /backendWindow\.elapsedDays/);
  assert.match(source, /backendWindow\.isExpired/);
});

test("payment summary shows contract completion blockers from related workflows", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsSnapshotCards.tsx", import.meta.url),
    "utf8",
  );
  const viewSource = readFileSync(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /actions\?: OperationsActionViewModel\[\]/);
  assert.match(source, /documentTracking\?: OperationsDocumentTrackingViewModel \| null/);
  assert.match(source, /financeOps\?: OperationsFinanceOpsViewModel \| null/);
  assert.match(source, /listingSnapshot\?: Record<string, unknown> \| null/);
  assert.match(source, /Tamamlama kontrol/);
  assert.match(source, /Sözleşme/);
  assert.match(source, /Belge süreci/);
  assert.match(source, /Ödeme \/ iade/);
  assert.match(source, /İlan/);
  assert.match(
    source,
    /confirmAction\?\.disabledReason/,
    "The payment summary should surface the same blocker that disables the complete-contract action.",
  );
  assert.match(
    viewSource,
    /actions=\{viewModel\.actions\}/,
    "The summary card needs action eligibility to explain why completion is blocked.",
  );
  assert.match(viewSource, /documentTracking=\{viewModel\.documentTracking\}/);
  assert.match(viewSource, /financeOps=\{viewModel\.financeOps\}/);
  assert.match(viewSource, /listingSnapshot=\{viewModel\.listingSnapshot\}/);
});

test("payment summary does not treat resolved finance status as a blocker", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsSnapshotCards.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /const financeBlocksCompletion =[\s\S]*?!\["issue_resolved", "payment_not_received", "refund_completed", "deposit_forfeited"\]\.includes/,
    "Terminal finance statuses are history, not an open blocker in the payment summary.",
  );
  assert.match(
    source,
    /financeBlocksCompletion\s*\?\s*`\$\{financeOps\.statusLabel\}; önce bu finans işi kapatılmalı\.`\s*:\s*`\$\{financeOps\.statusLabel\}; finans tarafında açık iş yok\.`/,
    "Resolved finance copy should tell admin there is no open finance work.",
  );
});

test("payment not received is a closed operation, not a document queue item", () => {
  const controllerSource = readFileSync(
    new URL("../lib/admin-ui/operations-controller.ts", import.meta.url),
    "utf8",
  );
  const viewModelSource = readFileSync(
    new URL("../lib/admin-ui/operations-view-model.ts", import.meta.url),
    "utf8",
  );
  const viewSource = readFileSync(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(controllerSource, /payment_not_received/);
  assert.match(viewModelSource, /payment_not_received: "Ödeme alınmadı"/);
  assert.match(
    viewModelSource,
    /normalizedStatus === "manual_resolution_required"[\s\S]*?\["manual_resolution_required", "issue_resolved", "payment_not_received"\]/,
  );
  assert.match(
    viewModelSource,
    /financeStatus === "payment_not_received"[\s\S]*?return "all"/,
    "Ödeme alınmadı ile kapanan kayıt belge bekleyenlere veya manuel iadeye düşmemeli.",
  );
  assert.match(
    viewSource,
    /status === "payment_not_received"[\s\S]*?queue: "all"/,
    "UI ödeme alınmadı sonrası genel listeye dönmeli; belge süreci başlamamalı.",
  );
});

test("payment summary explains paid held reservations through document workflow before completion", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsSnapshotCards.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /const documentBlocksContract = Boolean\(documentTracking && documentTracking\.status !== "completed" && isPaidOrder\);/,
    "Only paid operations should let document tracking own the contract-completion explanation.",
  );
  assert.match(
    source,
    /Belge süreci tamamlanınca sözleşme kesinleşebilir\./,
    "A paid held listing should not show a generic listing-status blocker while document tracking owns the next step.",
  );
  assert.match(
    source,
    /documentBlocksContract\s*\?\s*"Belge süreci tamamlanınca sözleşme kesinleşebilir\."/,
    "The contract control should prioritize the document-owned next step over raw confirm-action blockers.",
  );
});

test("payment summary treats completed contracts and passive held listings as normal state", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsSnapshotCards.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /const isContractCompleted =/);
  assert.match(source, /Sözleşme tamamlandı; tekrar işlem gerekmez\./);
  assert.match(source, /const isPassiveHeldListing =/);
  assert.match(
    source,
      /İlan müşteri tarafında görünmüyor; ödeme veya sözleşme kapsamında tutulmuş durumda\. Bu durum bu operasyon için blokaj değildir\./,
    "Completed or paid operations should explain the business meaning without exposing raw passive status as the main message.",
  );
  assert.doesNotMatch(
    source,
    /listingStatus !== "active" && listingStatus !== "reserved"/,
    "Passive listings must not be treated as a generic completion blocker.",
  );
});

test("reservation summary derives completed contract label from confirmed paid context", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsSnapshotCards.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /const statusLabel = deriveReservationOperationStatusLabel\(\{\s*reservationStatus: status,\s*reservationSnapshot,\s*\}\);/,
    "Reservation details should derive the admin-facing status from the whole operation context.",
  );
  assert.match(source, /Sözleşme tamamlandı \/ kesinleşti/);
});

test("listing summary derives rented contract state instead of showing raw passive status", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsSnapshotCards.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /const statusLabel = deriveListingOperationStatusLabel\(\{\s*listingStatus: status,\s*reservationSnapshot,\s*\}\);/,
    "Listing details should derive the admin-facing status from the whole operation context.",
  );
  assert.match(source, /Kiralandı \/ Sözleşme tamamlandı/);
  assert.match(source, /Ödeme sonrası tutuluyor \/ yayında değil/);
  assert.match(
    source,
    /if \(statusLabel\) items\.push\(\{ label: "Durum", value: <OperationsStatusBadge status=\{statusLabel\} \/> \}\);/,
    "Listing details must render the derived status label instead of raw listing.status=passive.",
  );
});

test("timeline makes listing publication state explicit after admin cancellation", () => {
  const entries = buildOperationsTimelineEntries(
    {
      latestEvent: {
        workflow_name: "admin_cancel_reservation",
        reason: "admin cancellation",
        created_at: "2026-05-05T21:07:15.770002+00:00",
      },
    },
    {
      listing: {
        status: "active",
      },
      latestEvent: {
        workflow_name: "admin_cancel_reservation",
        reason: "admin cancellation",
        created_at: "2026-05-05T21:07:15.770002+00:00",
      },
    },
  );

  assert.deepEqual(entries.map((entry) => entry.label), ["Rezervasyon iptali"]);
  assert.match(entries[0]?.detail ?? "", /Rezervasyon iptali sonrası ilan yayında/);
});

test("timeline deduplicates document completion event and tells the operation lifecycle", () => {
  const entries = buildOperationsTimelineEntries(
    {
      reservation: {
        status: "confirmed",
        created_at: "2026-05-01T08:30:00.000000+00:00",
      },
      order: {
        status: "completed",
        created_at: "2026-05-01T08:35:00.000000+00:00",
      },
      payment: {
        status: "succeeded",
        updated_at: "2026-05-01T10:00:00.000000+00:00",
      },
      latestEvent: {
        workflow_name: "admin_mark_documents_completed",
        note: "Belgeler kontrol edildi.",
        created_at: "2026-05-06T23:08:16.480127+00:00",
      },
    },
    {
      listing: {
        status: "passive",
      },
      latestEvent: {
        workflow_name: "admin_mark_documents_completed",
        note: "Belgeler kontrol edildi.",
        created_at: "2026-05-06T23:08:16.480127+00:00",
      },
    },
    {
      status: "completed",
      adminNote: "Belgeler kontrol edildi.",
      updatedAt: "2026-05-06T23:08:16.480127+00:00",
    },
  );

  assert.deepEqual(entries.map((entry) => entry.label), [
    "Rezervasyon oluşturuldu",
    "Ödeme onaylandı",
    "Belgeler tamamlandı",
    "Sözleşme tamamlandı",
  ]);
  assert.equal(entries.filter((entry) => entry.label === "Belgeler tamamlandı").length, 1);
  assert.equal(entries[2]?.detail, "Not: Belgeler kontrol edildi.");
});

test("timeline translates payment issue resolution into Turkish", () => {
  const entries = buildOperationsTimelineEntries(
    {
      reservation: {
        id: "res-issue",
        status: "pending",
        created_at: "2026-05-01T10:00:00.000Z",
      },
      order: {
        id: "order-issue",
        status: "completed",
        updated_at: "2026-05-07T15:51:00.000Z",
      },
      payment: {
        id: "payment-issue",
        status: "succeeded",
        updated_at: "2026-05-07T15:51:00.000Z",
      },
      latestEvent: {
        id: "event-issue",
        workflow_name: "admin_mark_payment_issue_resolved",
        note: "Banka hareketi kontrol edildi.",
        created_at: "2026-05-07T15:51:00.000Z",
      },
    },
    null,
  );

  assert.ok(entries.some((entry) => entry.label === "Ödeme sorunu çözüldü"));
  assert.ok(!entries.some((entry) => entry.label.includes("admin_mark_payment_issue_resolved")));
});

test("timeline keeps resolved payment issue in the final lifecycle", () => {
  const entries = buildOperationsTimelineEntries(
    {
      reservation: {
        id: "res-issue",
        status: "confirmed",
        created_at: "2026-05-01T10:00:00.000Z",
      },
      order: {
        id: "order-issue",
        status: "completed",
      },
      payment: {
        id: "payment-issue",
        status: "succeeded",
        updated_at: "2026-05-07T15:51:00.000Z",
      },
      latestEvent: {
        id: "event-docs",
        workflow_name: "admin_mark_documents_completed",
        note: "Belgeler tamamlandı.",
        created_at: "2026-05-07T16:00:00.000Z",
      },
    },
    null,
    {
      status: "completed",
      adminNote: "Belgeler tamamlandı.",
      updatedAt: "2026-05-07T16:00:00.000Z",
    },
    {
      status: "issue_resolved",
      adminNote: "Banka hareketi kontrol edildi.",
      updatedAt: "2026-05-07T15:55:00.000Z",
    },
  );

  assert.deepEqual(entries.map((entry) => entry.label), [
    "Rezervasyon oluşturuldu",
    "Ödeme onaylandı",
    "Belgeler tamamlandı",
    "Ödeme sorunu çözüldü",
    "Sözleşme tamamlandı",
  ]);
});

test("timeline uses sanitized event history when backend history is available", () => {
  const entries = buildOperationsTimelineEntries(
    {
      reservation: {
        id: "res-history",
        status: "confirmed",
        created_at: "2026-05-01T10:00:00.000Z",
      },
      order: {
        id: "order-history",
        status: "completed",
      },
      payment: {
        id: "payment-history",
        status: "succeeded",
        updated_at: "2026-05-01T11:00:00.000Z",
      },
      latestEvent: {
        id: "latest-only",
        workflow_name: "admin_mark_documents_completed",
        note: "latest fallback should not duplicate",
        created_at: "2026-05-07T16:00:00.000Z",
      },
    },
    null,
    {
      status: "completed",
      adminNote: "fallback should not duplicate",
      updatedAt: "2026-05-07T16:00:00.000Z",
    },
    null,
    [
      {
        workflow_name: "admin_request_documents",
        note: "Belgeler istendi.",
        created_at: "2026-05-06T10:00:00.000Z",
        payload: { token: "SECRET" },
      },
      {
        workflow_name: "admin_mark_documents_completed",
        note: "Belgeler tamamlandı.",
        created_at: "2026-05-07T16:00:00.000Z",
        raw_callback_body: "SECRET",
      },
    ],
  );

  assert.deepEqual(entries.map((entry) => entry.label), [
    "Rezervasyon oluşturuldu",
    "Ödeme onaylandı",
    "Belge istendi",
    "Belgeler tamamlandı",
    "Sözleşme tamamlandı",
  ]);
  assert.equal(entries.filter((entry) => entry.label === "Belgeler tamamlandı").length, 1);
  assert.doesNotMatch(JSON.stringify(entries), /SECRET|payload|raw_callback_body/);
});

test("operations timeline formats timestamps for Turkish admins and uses scrollable content", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsTimeline.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /formatTimelineDate/);
  assert.match(source, /locale:\s*"tr-TR"/);
  assert.match(source, /timeZone:\s*"Europe\/Istanbul"/);
  assert.match(source, /max-h-\[360px\] overflow-y-auto/);
  assert.doesNotMatch(
    source,
    /\{entry\.timestamp\}/,
    "Timeline should not render raw ISO timestamps.",
  );
});

test("operations view passes document and finance tracking to timeline", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /documentTracking=\{viewModel\.documentTracking\}/);
  assert.match(source, /financeOps=\{viewModel\.financeOps\}/);
});

test("payment issue resolution moves the admin to the document queue", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /status === "issue_resolved"[\s\S]*?queue: "document_waiting"/,
    "Sorun çözüldü sonrası kayıt Belge Bekleyenler kuyruğuna geçtiği için UI da o kuyruğa yönlenmeli.",
  );
});

test("payment issue resolution does not leave a stale success banner in document queue", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /if \(status === "issue_resolved"\) \{[\s\S]*?setActionSuccess\(null\)[\s\S]*?queue: "document_waiting"/,
    "Belge Bekleyenler kuyruğuna taşınan kayıtta ödeme sorunu başarı mesajı üstte kalmamalı.",
  );
});

test("document completion moves the admin to the completed queue", () => {
  const source = readFileSync(
    new URL("../components/admin-operations/OperationsView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /status === "completed"[\s\S]*?queue: "completed"/,
    "Belgeler tamamlandı sonrası kayıt Belge Bekleyenler listesinden düştüğü için UI Tamamlananlar kuyruğuna yönlenmeli.",
  );
});

// These tests verify that the view-model sanitizer does NOT leak raw
// backend fields into the view layer. Only allow-listed keys should
// appear in the sanitized snapshots.

test("reservationSnapshot strips unknown / sensitive keys", () => {
  const model = buildOperationsViewModel({
    overview: createOverview(),
    selectedReservationId: "res-1",
    reservationSnapshot: {
      reservation: {
        id: "res-1",
        status: "pending",
        move_in_date: "2026-06-01",
        secret_field: "should-not-appear",
      },
      order: {
        id: "ord-1",
        status: "pending",
        total_amount: 5000,
        currency: "TRY",
        internal_ref: "secret-internal",
      },
      payment: {
        id: "pay-1",
        status: "pending",
        amount: 5000,
        currency: "TRY",
        provider_callback_raw: "{should-not-appear}",
      },
      listing: {
        id: "lst-1",
        status: "active",
        title: "Test",
        city: "Istanbul",
        district: "Kadikoy",
        owner_user_id: "should-not-appear",
      },
      contact: {
        fullName: "Ali Veli",
        phone: "555-1234",
        email: "ali@test.com",
        preferredContactMethod: "phone",
        preferredContactTime: "afternoon",
        occupantFullName: "Ayse",
        documentReadiness: "ready",
        note: "test note",
        ssn: "should-not-appear",
      },
      eligibility: {
        can_cancel: true,
        can_confirm: false,
        admin_secret: "should-not-appear",
      },
      latest_event: {
        id: "evt-1",
        workflow_name: "admin_confirm_reservation",
        reason: "test",
        note: "note",
        created_at: "2026-05-01",
        payload_raw: "{should-not-appear}",
      },
      raw_callback_body: "should-not-appear",
    },
    listingSnapshot: null,
    actionPending: null,
  });

  const snap = model.reservationSnapshot!;

  // reservation
  const reservation = snap.reservation as Record<string, unknown>;
  assert.ok(!("secret_field" in reservation), "secret_field leaked into reservation");

  // order
  const order = snap.order as Record<string, unknown>;
  assert.ok(!("internal_ref" in order), "internal_ref leaked into order");

  // payment
  const payment = snap.payment as Record<string, unknown>;
  assert.ok(!("provider_callback_raw" in payment), "provider_callback_raw leaked into payment");

  // listing
  const listing = snap.listing as Record<string, unknown>;
  assert.ok(!("owner_user_id" in listing), "owner_user_id leaked into listing");

  // contact
  const contact = snap.contact as Record<string, unknown>;
  assert.ok(!("ssn" in contact), "ssn leaked into contact");

  // eligibility
  const eligibility = snap.eligibility as Record<string, unknown>;
  assert.ok(!("admin_secret" in eligibility), "admin_secret leaked into eligibility");

  // latest event
  const latestEvent = snap.latestEvent as Record<string, unknown>;
  assert.ok(!("payload_raw" in latestEvent), "payload_raw leaked into latestEvent");

  // top-level raw
  assert.ok(!("raw_callback_body" in snap), "raw_callback_body leaked into snapshot");
});

test("listingSnapshot strips unknown / sensitive keys", () => {
  const model = buildOperationsViewModel({
    overview: createOverview(),
    selectedReservationId: "res-1",
    reservationSnapshot: {
      reservation: { id: "res-1", status: "pending" },
      listing: { id: "lst-1" },
    },
    listingSnapshot: {
      listing: {
        id: "lst-1",
        status: "active",
        title: "Test",
        city: "Ankara",
        district: "Cankaya",
        owner_secret: "should-not-appear",
      },
      latest_event: {
        id: "evt-2",
        workflow_name: "admin_reopen_listing",
        reason: "test",
        note: "note",
        created_at: "2026-05-02",
        raw_data: "{should-not-appear}",
      },
      eligibility: {
        can_reopen: true,
        internal_flag: "should-not-appear",
      },
      raw_admin_data: "should-not-appear",
    },
    actionPending: null,
  });

  const snap = model.listingSnapshot!;

  const listing = snap.listing as Record<string, unknown>;
  assert.ok(!("owner_secret" in listing), "owner_secret leaked into listing");

  const latestEvent = snap.latestEvent as Record<string, unknown>;
  assert.ok(!("raw_data" in latestEvent), "raw_data leaked into latestEvent");

  const eligibility = snap.eligibility as Record<string, unknown>;
  assert.ok(!("internal_flag" in eligibility), "internal_flag leaked into eligibility");

  assert.ok(!("raw_admin_data" in snap), "raw_admin_data leaked into snapshot");
});

// ── Fixtures ────────────────────────────────────────────────────────────────

function createOverview() {
  return {
    reservations: {
      items: [{ id: "res-1", status: "pending", listing_id: "lst-1" }],
      limit: 20,
      offset: 0,
    },
    orders: { items: [], limit: 100, offset: 0 },
    payments: { items: [], limit: 100, offset: 0 },
  };
}
