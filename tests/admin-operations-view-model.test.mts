import assert from "node:assert/strict";
import test from "node:test";

import {
  executeOperationsAction,
  loadOperationsModel,
  updateOperationsDocumentTracking,
  updateOperationsFinanceOps,
} from "../lib/admin-ui/operations-controller.ts";
import { buildOperationsViewModel } from "../lib/admin-ui/operations-view-model.ts";

test("operations view model disables actions when snapshot eligibility is false", () => {
  const model = buildOperationsViewModel({
    overview: createOverview(),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: { id: "reservation-1", status: "pending" },
      listing: { id: "listing-1", status: "passive" },
      eligibility: {
        can_cancel: false,
        can_confirm: false,
      },
    },
    listingSnapshot: {
      listing: { id: "listing-1", status: "passive" },
      eligibility: {
        can_reopen: false,
      },
    },
    actionPending: null,
  });

  assert.deepEqual(model.actions, [
      {
        id: "cancel",
        label: "İptal et",
        enabled: false,
        disabledReason:
          "Bu işlem mevcut kayıt durumunda kullanılamaz. Önce ödeme, iade veya belge sürecindeki açık işi kontrol et.",
      },
      {
        id: "confirm",
        label: "Sözleşmeyi tamamla",
        enabled: false,
        disabledReason:
          "Bu işlem mevcut kayıt durumunda kullanılamaz. Önce ödeme, iade veya belge sürecindeki açık işi kontrol et.",
      },
      {
        id: "reopen",
        label: "İlanı yeniden aç",
        enabled: false,
        disabledReason:
          "Bu işlem mevcut kayıt durumunda kullanılamaz. Önce ödeme, iade veya belge sürecindeki açık işi kontrol et.",
      },
  ]);
});

test("operations view model disables every workflow action while an action is pending", () => {
  const model = buildOperationsViewModel({
    overview: createOverview(),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: { id: "reservation-1", status: "pending" },
      listing: { id: "listing-1", status: "passive" },
      eligibility: {
        can_cancel: true,
        can_confirm: true,
      },
    },
    listingSnapshot: {
      listing: { id: "listing-1", status: "passive" },
      eligibility: {
        can_reopen: true,
      },
    },
    actionPending: "confirm",
  });

  assert.deepEqual(
    model.actions.map((action) => ({
      id: action.id,
      enabled: action.enabled,
      disabledReason: action.disabledReason,
    })),
    [
      {
        id: "cancel",
        enabled: false,
        disabledReason: "İşlem devam ederken yeni aksiyon başlatılamaz.",
      },
      {
        id: "confirm",
        enabled: false,
        disabledReason: "İşlem devam ederken yeni aksiyon başlatılamaz.",
      },
      {
        id: "reopen",
        enabled: false,
        disabledReason: "İşlem devam ederken yeni aksiyon başlatılamaz.",
      },
    ],
  );
});

test("operations view model omits reopen action when no listing id is available", () => {
  const model = buildOperationsViewModel({
    overview: createOverview({
      reservations: {
        items: [
          {
            id: "reservation-1",
            status: "pending",
            listing_id: null,
          },
        ],
        limit: 20,
        offset: 0,
      },
    }),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: { id: "reservation-1", status: "pending" },
      eligibility: {
        can_cancel: true,
        can_confirm: true,
      },
    },
    listingSnapshot: null,
    actionPending: null,
  });

  assert.equal(model.selectedListingId, null);
  assert.deepEqual(model.actions.map((action) => action.id), ["cancel", "confirm"]);
});

test("operations view model omits reopen action when listing is already active", () => {
  const model = buildOperationsViewModel({
    overview: createOverview(),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: { id: "reservation-1", status: "cancelled" },
      listing: { id: "listing-1", status: "active" },
      eligibility: {
        can_cancel: false,
        can_confirm: false,
      },
    },
    listingSnapshot: {
      listing: { id: "listing-1", status: "active" },
      eligibility: {
        can_reopen: false,
        can_reopen_reason: "Ilan durumu bu islem icin uygun degil.",
      },
    },
    actionPending: null,
  });

  assert.deepEqual(model.actions.map((action) => action.id), ["cancel", "confirm"]);
});

test("operations view model does not copy raw sensitive payload fields into output", () => {
  const model = buildOperationsViewModel({
    overview: createOverview({
      payments: {
        items: [
          {
            id: "payment-1",
            order_id: "order-1",
            status: "succeeded",
            payload: "do-not-copy-payment-payload",
            raw_callback_payload: "do-not-copy-raw-callback",
            payment_events: {
              payload: "do-not-copy-event-payload",
            },
          },
        ],
        limit: 100,
        offset: 0,
      },
    }),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: {
        id: "reservation-1",
        status: "pending",
        exact_address: "do-not-copy-exact-address",
      },
      listing: {
        id: "listing-1",
        status: "passive",
        exact_address: "do-not-copy-listing-address",
      },
      payment: {
        id: "payment-1",
        status: "succeeded",
        payload: "do-not-copy-snapshot-payment-payload",
      },
      order_items: [
        {
          item_type: "main_item",
          code: "deposit",
          label: "Kapora",
          amount: 17000,
          payload: "do-not-copy-item-payload",
        },
        {
          item_type: "service_item",
          code: "cleaning",
          label: "Temizlik",
          amount: 2200,
        },
      ],
      latest_event: {
        id: "event-1",
        workflow_name: "admin_confirm_reservation",
        payload: "do-not-copy-event-payload",
      },
      eligibility: {
        can_cancel: true,
        can_confirm: true,
      },
    },
    listingSnapshot: {
      listing: { id: "listing-1", status: "passive" },
      eligibility: {
        can_reopen: true,
      },
    },
    actionPending: null,
  });

  const serialized = JSON.stringify(model);

  assert.doesNotMatch(serialized, /do-not-copy/);
  assert.doesNotMatch(serialized, /exact_address/);
  assert.doesNotMatch(serialized, /raw_callback_payload/);
  assert.doesNotMatch(serialized, /payment_events/);
  assert.match(serialized, /orderItems/);
  assert.match(serialized, /Kapora/);
  assert.match(serialized, /Temizlik/);
});

test("operations view model exposes reservation guest count, note, and listing summary fields", () => {
  const model = buildOperationsViewModel({
    overview: createOverview(),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: {
        id: "reservation-1",
        status: "pending",
        move_in_date: "2026-05-01",
        stay_months: 6,
        guest_count: 2,
        note: "Misafirler erken giris isteyebilir",
      },
      listing: {
        id: "listing-1",
        status: "passive",
        title: "Sisli 2+1",
        city: "Istanbul",
        district: "Sisli",
      },
      eligibility: { can_cancel: true, can_confirm: true },
    },
    listingSnapshot: {
      listing: {
        id: "listing-1",
        status: "passive",
        title: "Sisli 2+1",
        city: "Istanbul",
        district: "Sisli",
      },
      eligibility: { can_reopen: false },
    },
    actionPending: null,
  });

  const reservation = (model.reservationSnapshot ?? {})["reservation"] as Record<string, unknown> | undefined;
  const reservationListing = (model.reservationSnapshot ?? {})["listing"] as Record<string, unknown> | undefined;
  const listingSnapshotListing = (model.listingSnapshot ?? {})["listing"] as Record<string, unknown> | undefined;

  assert.equal(reservation?.guest_count, 2);
  assert.equal(reservation?.note, "Misafirler erken giris isteyebilir");
  assert.equal(reservationListing?.title, "Sisli 2+1");
  assert.equal(reservationListing?.city, "Istanbul");
  assert.equal(reservationListing?.district, "Sisli");
  assert.equal(listingSnapshotListing?.title, "Sisli 2+1");
  assert.equal(listingSnapshotListing?.city, "Istanbul");
  assert.equal(listingSnapshotListing?.district, "Sisli");
});

test("operations view model localizes status labels to Turkish for admin readability", () => {
  const model = buildOperationsViewModel({
    overview: createOverview({
      reservations: {
        items: [
          {
            id: "reservation-1",
            listing_id: "listing-1",
            status: "pending",
            move_in_date: "2026-05-01",
            stay_months: 6,
            listing: {
              id: "listing-1",
              title: "Kadikoy 2+1",
              status: "passive",
              city: "Istanbul",
              district: "Kadikoy",
            },
          },
        ],
        limit: 20,
        offset: 0,
      },
      orders: {
        items: [
          {
            id: "order-1",
            reservation_id: "reservation-1",
            status: "completed",
            total_amount: 25000,
            currency: "TRY",
          },
        ],
        limit: 100,
        offset: 0,
      },
      payments: {
        items: [
          {
            id: "payment-1",
            order_id: "order-1",
            status: "succeeded",
            amount: 25000,
            currency: "TRY",
          },
        ],
        limit: 100,
        offset: 0,
      },
    }),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: { id: "reservation-1", status: "pending" },
      payment: { id: "payment-1", status: "succeeded" },
      listing: { id: "listing-1", status: "passive" },
      eligibility: { can_cancel: true, can_confirm: true },
    },
    listingSnapshot: {
      listing: { id: "listing-1", status: "passive" },
      eligibility: { can_reopen: true },
    },
    actionPending: null,
  });

  assert.deepEqual(
    {
      reservation: model.rows[0]?.reservationStatus,
      order: model.rows[0]?.orderStatus,
      payment: model.rows[0]?.paymentStatus,
    },
    {
      reservation: "Beklemede",
      order: "Tamamland\u0131",
      payment: "Ba\u015far\u0131l\u0131",
    },
  );
});

test("operations view model assigns queue labels and sorts risky work first", () => {
  const model = buildOperationsViewModel({
    overview: createOverview({
      reservations: {
        items: [
          reservationRow("reservation-docs", "Doc Listing", "pending"),
          {
            ...reservationRow("reservation-refund-request", "Refund Request Listing", "pending"),
            finance_ops: { status: "refund_required" },
          },
          reservationRow("reservation-refund", "Refund Listing", "cancelled"),
          reservationRow("reservation-issue", "Issue Listing", "pending"),
          reservationRow("reservation-waiting-payment", "Waiting Payment Listing", "pending"),
          {
            ...reservationRow("reservation-payment-closed", "Payment Closed Listing", "cancelled"),
            finance_ops: { status: "payment_not_received" },
          },
        ],
        limit: 20,
        offset: 0,
      },
      orders: {
        items: [
          orderRow("order-docs", "reservation-docs"),
          orderRow("order-refund-request", "reservation-refund-request"),
          orderRow("order-refund", "reservation-refund"),
          orderRow("order-issue", "reservation-issue"),
          orderRow("order-waiting-payment", "reservation-waiting-payment"),
          { ...orderRow("order-payment-closed", "reservation-payment-closed"), status: "failed" },
        ],
        limit: 100,
        offset: 0,
      },
      payments: {
        items: [
          paymentRow("payment-docs", "order-docs", "succeeded"),
          paymentRow("payment-refund-request", "order-refund-request", "succeeded"),
          paymentRow("payment-refund", "order-refund", "succeeded"),
          paymentRow("payment-issue", "order-issue", "conflict"),
          paymentRow("payment-waiting", "order-waiting-payment", "pending"),
          paymentRow("payment-closed", "order-payment-closed", "failed"),
        ],
        limit: 100,
        offset: 0,
      },
    }),
    selectedReservationId: "reservation-docs",
    reservationSnapshot: {
      reservation: { id: "reservation-docs", status: "pending" },
      listing: { id: "listing-docs", status: "passive" },
      payment: { id: "payment-docs", status: "succeeded" },
      eligibility: { can_cancel: true, can_confirm: true },
    },
    documentTracking: {
      reservation_id: "reservation-docs",
      document_status: "waiting",
    },
    financeOps: {
      reservation_id: "reservation-docs",
      finance_status: null,
      issue_flags: {},
    },
    listingSnapshot: {
      listing: { id: "listing-docs", status: "passive" },
      eligibility: { can_reopen: false },
    },
    actionPending: null,
  });

  assert.deepEqual(
    model.rows.map((row) => [row.reservationId, row.queue, row.primaryStatus]),
    [
      ["reservation-issue", "payment_issues", "Ödeme sorunu"],
      ["reservation-refund-request", "refund_requests", "İptal / iade talebi"],
      ["reservation-refund", "manual_refunds", "Manuel iade bekliyor"],
      ["reservation-docs", "document_waiting", "Belge bekliyor"],
      ["reservation-waiting-payment", "all", "\u00d6deme bekliyor"],
      ["reservation-payment-closed", "all", "Ödeme alınmadı / süreç kapandı"],
    ],
  );
});

test("operations view model labels confirmed paid reservations as rented contract completed", () => {
  const model = buildOperationsViewModel({
    overview: createOverview({
      reservations: {
        items: [
          {
            ...reservationRow("reservation-completed", "Completed Listing", "confirmed"),
            listing: {
              id: "listing-reservation-completed",
              title: "Completed Listing",
              status: "passive",
              city: "Istanbul",
              district: "Uskudar",
            },
          },
        ],
        limit: 20,
        offset: 0,
      },
      orders: {
        items: [
          {
            ...orderRow("order-completed", "reservation-completed"),
            status: "completed",
          },
        ],
        limit: 100,
        offset: 0,
      },
      payments: {
        items: [
          paymentRow("payment-completed", "order-completed", "succeeded"),
        ],
        limit: 100,
        offset: 0,
      },
    }),
    selectedReservationId: "reservation-completed",
    reservationSnapshot: {
      reservation: { id: "reservation-completed", status: "confirmed" },
      order: { id: "order-completed", status: "completed" },
      payment: { id: "payment-completed", status: "succeeded" },
      listing: { id: "listing-reservation-completed", status: "passive" },
      eligibility: { can_cancel: false, can_confirm: false },
    },
    listingSnapshot: {
      listing: { id: "listing-reservation-completed", status: "passive" },
      eligibility: { can_reopen: false },
    },
    actionPending: null,
  });

  assert.equal(model.rows[0]?.queue, "completed");
  assert.equal(model.rows[0]?.primaryStatus, "Kiralandı / Sözleşme tamamlandı");
});

test("operations action executor requires cancel note and sends refund decision", async () => {
  const calls: unknown[] = [];
  const dependencies = createActionDependencies({
    cancelReservationWorkflow: async (reservationId, body) => {
      calls.push(["cancel", reservationId, body]);
      return {};
    },
  });

  await assert.rejects(
    () =>
      executeOperationsAction(dependencies, {
        actionId: "cancel",
        refundDecision: "manual_refund",
        noteText: "   ",
        reasonText: "",
        selectedListingId: "listing-1",
        selectedReservationId: "reservation-1",
      }),
    /İptal notu zorunludur/,
  );

  await executeOperationsAction(dependencies, {
    actionId: "cancel",
    refundDecision: "manual_refund",
    noteText: "  customer changed plans  ",
    reasonText: "",
    selectedListingId: "listing-1",
    selectedReservationId: "reservation-1",
  });

  assert.deepEqual(calls, [
    [
      "cancel",
      "reservation-1",
      {
        refundDecision: "manual_refund",
        note: "customer changed plans",
      },
    ],
  ]);
});

test("operations document and finance updates enforce required admin notes", async () => {
  const dependencies = createActionDependencies();

  await assert.rejects(
    () =>
      updateOperationsDocumentTracking(dependencies, {
        selectedReservationId: "reservation-1",
        status: "failed",
        noteText: " ",
      }),
    /Eksik\/başarısız belge notu zorunludur/,
  );

  await assert.rejects(
    () =>
      updateOperationsDocumentTracking(dependencies, {
        selectedReservationId: "reservation-1",
        status: "completed",
        noteText: " ",
      }),
    /Belgeler tamamlandı notu zorunludur/,
  );

  await assert.rejects(
    () =>
      updateOperationsFinanceOps(dependencies, {
        selectedReservationId: "reservation-1",
        status: "refund_completed",
        noteText: " ",
      }),
    /İade tamamlandı notu zorunludur/,
  );

  await assert.rejects(
    () =>
      updateOperationsFinanceOps(dependencies, {
        selectedReservationId: "reservation-1",
        status: "manual_resolution_required",
        noteText: " ",
      }),
    /Ödeme sorunu notu zorunludur/,
  );

  await assert.rejects(
    () =>
      updateOperationsFinanceOps(dependencies, {
        selectedReservationId: "reservation-1",
        status: "deposit_forfeited",
        noteText: " ",
      }),
    /İade reddi notu zorunludur/,
  );
});

test("operations view model formats monetary amounts with Turkish thousands separators", () => {
  const model = buildOperationsViewModel({
    overview: createOverview({
      orders: {
        items: [
          {
            id: "order-1",
            reservation_id: "reservation-1",
            status: "pending",
            total_amount: 29800,
            currency: "TRY",
          },
        ],
        limit: 100,
        offset: 0,
      },
      payments: {
        items: [
          {
            id: "payment-1",
            order_id: "order-1",
            status: "succeeded",
            amount: 29800,
            currency: "TRY",
          },
        ],
        limit: 100,
        offset: 0,
      },
    }),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: { id: "reservation-1", status: "pending" },
      payment: { id: "payment-1", status: "succeeded" },
      listing: { id: "listing-1", status: "passive" },
      eligibility: { can_cancel: true, can_confirm: true },
    },
    listingSnapshot: {
      listing: { id: "listing-1", status: "passive" },
      eligibility: { can_reopen: true },
    },
    actionPending: null,
  });

  assert.equal(model.rows[0]?.amountLabel, "29.800 TRY");
});

test("operations view model uses snapshot eligibility reasons for disabled actions", () => {
  const model = buildOperationsViewModel({
    overview: createOverview(),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: { id: "reservation-1", status: "pending" },
      listing: { id: "listing-1", status: "active" },
      eligibility: {
        can_cancel: false,
        can_cancel_reason: "Banka odeme onayi bekleniyor.",
        can_confirm: false,
        can_confirm_reason: "Bu ilan icin baska tamamlanmis rezervasyon var.",
      },
    },
    listingSnapshot: {
      listing: { id: "listing-1", status: "active" },
      eligibility: {
        can_reopen: false,
        can_reopen_reason: "Ilan durumu bu islem icin uygun degil.",
      },
    },
    actionPending: null,
  });

  assert.deepEqual(
    model.actions.map((action) => ({
      id: action.id,
      enabled: action.enabled,
      disabledReason: action.disabledReason,
    })),
    [
      {
        id: "cancel",
        enabled: false,
        disabledReason:
          "Banka ödeme onayı bekleniyor. Ödeme sonucu gelmeden rezervasyonu iptal etmek, banka dönüşüyle çakışma riski yaratır.",
      },
      {
        id: "confirm",
        enabled: false,
        disabledReason:
          "Bu ilan başka bir rezervasyonla kapanmış. Sözleşmeyi tamamlamak için önce ilgili kayıtları kontrol et.",
      },
    ],
  );
});

test("operations view model falls back to generic disabled reason when snapshot omits reason", () => {
  const model = buildOperationsViewModel({
    overview: createOverview(),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: { id: "reservation-1", status: "pending" },
      listing: { id: "listing-1", status: "active" },
      eligibility: {
        can_cancel: false,
        can_confirm: false,
      },
    },
    listingSnapshot: {
      listing: { id: "listing-1", status: "active" },
      eligibility: {
        can_reopen: false,
      },
    },
    actionPending: null,
  });

  assert.deepEqual(
    model.actions.map((action) => action.disabledReason),
    [
      "Bu işlem mevcut kayıt durumunda kullanılamaz. Önce ödeme, iade veya belge sürecindeki açık işi kontrol et.",
      "Bu işlem mevcut kayıt durumunda kullanılamaz. Önce ödeme, iade veya belge sürecindeki açık işi kontrol et.",
    ],
  );
});

test("operations view model produces null selectedReservationId and empty actions for empty reservation list", () => {
  const model = buildOperationsViewModel({
    overview: {
      reservations: { items: [], limit: 20, offset: 0 },
      orders: { items: [], limit: 100, offset: 0 },
      payments: { items: [], limit: 100, offset: 0 },
    },
    selectedReservationId: null,
    reservationSnapshot: null,
    listingSnapshot: null,
    actionPending: null,
  });

  assert.equal(model.selectedReservationId, null);
  assert.equal(model.selectedListingId, null);
  assert.equal(model.rows.length, 0);
  assert.deepEqual(model.actions, []);
  assert.equal(model.reservationSnapshot, null);
  assert.equal(model.listingSnapshot, null);
});

test("operations view model preserves documentReadiness in sanitized contact snapshot", () => {
  const model = buildOperationsViewModel({
    overview: createOverview(),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: { id: "reservation-1", status: "pending" },
      listing: { id: "listing-1", status: "passive" },
      contact: {
        fullName: "Test User",
        phone: "555-1234",
        email: "test@test.com",
        documentReadiness: "needs_help",
        note: "test",
      },
      eligibility: { can_cancel: true, can_confirm: true },
    },
    listingSnapshot: null,
    actionPending: null,
  });

  const contact = (model.reservationSnapshot ?? {}).contact as Record<string, unknown> | undefined;
  assert.ok(contact);
  assert.equal(contact.documentReadiness, "needs_help");
  assert.equal(contact.fullName, "Test User");
});

test("operations view model does not include raw payment event payloads in sanitized snapshot", () => {
  const model = buildOperationsViewModel({
    overview: createOverview(),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: { id: "reservation-1", status: "pending" },
      listing: { id: "listing-1", status: "passive" },
      payment: {
        id: "pay-1",
        status: "succeeded",
        amount: 5000,
        currency: "TRY",
        raw_callback_body: "SECRET",
        provider_response: { secret: true },
      },
      eligibility: { can_cancel: true, can_confirm: true },
    },
    listingSnapshot: null,
    actionPending: null,
  });

  const serialized = JSON.stringify(model);
  assert.doesNotMatch(serialized, /SECRET/);
  assert.doesNotMatch(serialized, /raw_callback_body/);
  assert.doesNotMatch(serialized, /provider_response/);
});

test("operations view model exposes sanitized document tracking state", () => {
  const model = buildOperationsViewModel({
    overview: createOverview(),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: { id: "reservation-1", status: "pending" },
      payment: { id: "payment-1", status: "succeeded" },
      listing: { id: "listing-1", status: "passive" },
      eligibility: { can_cancel: true, can_confirm: true },
    },
    documentTracking: {
      reservation_id: "reservation-1",
      order_id: "order-1",
      document_status: "waiting",
      status_label: "Bekleniyor",
      admin_note: "Kimlik bekleniyor",
      updated_at: "2026-05-05T10:00:00.000Z",
      last_admin_user_id: "admin-1",
      payload: "do-not-copy-document-payload",
    },
    listingSnapshot: null,
    actionPending: null,
  });

  assert.deepEqual(model.documentTracking, {
    reservationId: "reservation-1",
    orderId: "order-1",
    status: "waiting",
    statusLabel: "Belge bekleniyor",
    allowedStatuses: ["completed", "failed"],
    disabledReason: null,
    adminNote: "Kimlik bekleniyor",
    updatedAt: "2026-05-05T10:00:00.000Z",
    lastAdminUserId: "admin-1",
    adminDisplayText: null,
  });
  assert.doesNotMatch(JSON.stringify(model), /do-not-copy/);
});

test("operations view model exposes sanitized finance ops state and issue flags", () => {
  const model = buildOperationsViewModel({
    overview: createOverview(),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: { id: "reservation-1", status: "pending" },
      payment: { id: "payment-1", status: "succeeded" },
      listing: { id: "listing-1", status: "passive" },
      eligibility: { can_cancel: true, can_confirm: true },
    },
    financeOps: {
      reservation_id: "reservation-1",
      order_id: "order-1",
      payment_id: "payment-1",
      finance_status: "manual_resolution_required",
      status_label: "Manual resolution required",
      recommended_status: "manual_resolution_required",
      admin_note: "Amount drift",
      updated_at: "2026-05-05T12:00:00.000Z",
      last_admin_user_id: "admin-1",
      admin_display: "Admin - Ayse Yilmaz",
      issue_flags: {
        amount_drift: true,
        ownership_drift: false,
        missing_payment: false,
      },
      payload: "do-not-copy-finance-payload",
    },
    listingSnapshot: null,
    actionPending: null,
  });

  assert.deepEqual(model.financeOps, {
    reservationId: "reservation-1",
    orderId: "order-1",
    paymentId: "payment-1",
    status: "manual_resolution_required",
    statusLabel: "Ödeme sorunu",
    recommendedStatus: "manual_resolution_required",
    allowedStatuses: ["manual_resolution_required", "issue_resolved", "payment_not_received"],
    hasVisibleWork: true,
    adminNote: "Amount drift",
    updatedAt: "2026-05-05T12:00:00.000Z",
    lastAdminUserId: "admin-1",
    adminDisplayText: "Admin - Ayse Yilmaz",
    depositRefundWindow: null,
    issueFlags: {
      amountDrift: true,
      ownershipDrift: false,
      missingPayment: false,
    },
  });
  assert.doesNotMatch(JSON.stringify(model), /do-not-copy/);
});

test("operations view model hides finance ops when there is no finance work", () => {
  const noFinanceWork = buildOperationsViewModel({
    overview: createOverview(),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: { id: "reservation-1", status: "pending" },
      payment: { id: "payment-1", status: "pending" },
      listing: { id: "listing-1", status: "active" },
      eligibility: { can_cancel: true, can_confirm: false },
    },
    financeOps: {
      reservation_id: "reservation-1",
      finance_status: null,
      recommended_status: null,
      issue_flags: {},
    },
    listingSnapshot: null,
    actionPending: null,
  });

  const manualRefund = buildOperationsViewModel({
    overview: createOverview(),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: { id: "reservation-1", status: "cancelled" },
      payment: { id: "payment-1", status: "succeeded" },
      listing: { id: "listing-1", status: "active" },
      eligibility: { can_cancel: false, can_confirm: false },
    },
    financeOps: {
      reservation_id: "reservation-1",
      finance_status: "refund_requested",
      issue_flags: {},
    },
    listingSnapshot: null,
    actionPending: null,
  });

  const resolvedPaymentIssue = buildOperationsViewModel({
    overview: createOverview(),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: { id: "reservation-1", status: "pending" },
      payment: { id: "payment-1", status: "succeeded" },
      listing: { id: "listing-1", status: "passive" },
      eligibility: { can_cancel: true, can_confirm: true },
    },
    financeOps: {
      reservation_id: "reservation-1",
      finance_status: "issue_resolved",
      admin_note: "Para hesaba geçti",
      issue_flags: {
        amount_drift: true,
      },
    },
    listingSnapshot: null,
    actionPending: null,
  });

  assert.equal(noFinanceWork.financeOps?.hasVisibleWork, false);
  assert.equal(manualRefund.financeOps?.hasVisibleWork, true);
  assert.equal(resolvedPaymentIssue.financeOps?.hasVisibleWork, false);
});

test("operations view model exposes only safe document workflow transitions", () => {
  const notRequested = buildOperationsViewModel({
    overview: createOverview(),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: { id: "reservation-1", status: "pending" },
      payment: { id: "payment-1", status: "succeeded" },
      listing: { id: "listing-1", status: "passive" },
      eligibility: { can_cancel: true, can_confirm: true },
    },
    documentTracking: {
      reservation_id: "reservation-1",
      document_status: "not_requested",
    },
    listingSnapshot: null,
    actionPending: null,
  });

  const waiting = buildOperationsViewModel({
    overview: createOverview(),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: { id: "reservation-1", status: "pending" },
      payment: { id: "payment-1", status: "succeeded" },
      listing: { id: "listing-1", status: "passive" },
      eligibility: { can_cancel: true, can_confirm: true },
    },
    documentTracking: {
      reservation_id: "reservation-1",
      document_status: "waiting",
    },
    listingSnapshot: null,
    actionPending: null,
  });

  const requested = buildOperationsViewModel({
    overview: createOverview(),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: { id: "reservation-1", status: "pending" },
      payment: { id: "payment-1", status: "succeeded" },
      listing: { id: "listing-1", status: "passive" },
      eligibility: { can_cancel: true, can_confirm: true },
    },
    documentTracking: {
      reservation_id: "reservation-1",
      document_status: "requested",
    },
    listingSnapshot: null,
    actionPending: null,
  });

  const cancelled = buildOperationsViewModel({
    overview: createOverview(),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: { id: "reservation-1", status: "cancelled" },
      listing: { id: "listing-1", status: "active" },
      eligibility: { can_cancel: false, can_confirm: false },
    },
    documentTracking: {
      reservation_id: "reservation-1",
      document_status: "not_requested",
    },
    listingSnapshot: null,
    actionPending: null,
  });

  const pendingPayment = buildOperationsViewModel({
    overview: createOverview(),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: { id: "reservation-1", status: "pending" },
      payment: { id: "payment-1", status: "pending" },
      listing: { id: "listing-1", status: "passive" },
      eligibility: { can_cancel: true, can_confirm: true },
    },
    documentTracking: {
      reservation_id: "reservation-1",
      document_status: "not_requested",
    },
    listingSnapshot: null,
    actionPending: null,
  });

  const openRefundRequest = buildOperationsViewModel({
    overview: createOverview(),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: { id: "reservation-1", status: "pending" },
      payment: { id: "payment-1", status: "succeeded" },
      listing: { id: "listing-1", status: "passive" },
      eligibility: { can_cancel: true, can_confirm: true },
    },
    documentTracking: {
      reservation_id: "reservation-1",
      document_status: "waiting",
    },
    financeOps: {
      reservation_id: "reservation-1",
      finance_status: "refund_required",
      issue_flags: {},
    },
    listingSnapshot: null,
    actionPending: null,
  });

  assert.deepEqual(notRequested.documentTracking?.allowedStatuses, ["requested"]);
  assert.deepEqual(requested.documentTracking?.allowedStatuses, ["waiting"]);
  assert.deepEqual(waiting.documentTracking?.allowedStatuses, ["completed", "failed"]);
  assert.deepEqual(cancelled.documentTracking?.allowedStatuses, []);
  assert.deepEqual(pendingPayment.documentTracking?.allowedStatuses, []);
  assert.equal(
    pendingPayment.documentTracking?.disabledReason,
    "Ödeme henüz başarılı değil. Belge süreci ödeme başarılı olduktan sonra başlatılabilir.",
  );
  assert.deepEqual(openRefundRequest.documentTracking?.allowedStatuses, []);
  assert.equal(
    openRefundRequest.documentTracking?.disabledReason,
    "Açık iptal / iade talebi varken belge süreci ilerletilemez. Önce talebi onayla veya reddet.",
  );
});

test("operations view model exposes only safe finance workflow transitions", () => {
  const noDecision = buildOperationsViewModel({
    overview: createOverview(),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: { id: "reservation-1", status: "cancelled" },
      listing: { id: "listing-1", status: "active" },
      eligibility: { can_cancel: false, can_confirm: false },
    },
    financeOps: {
      reservation_id: "reservation-1",
      finance_status: null,
      recommended_status: "refund_required",
      issue_flags: {},
    },
    listingSnapshot: null,
    actionPending: null,
  });

  const refundRequired = buildOperationsViewModel({
    overview: createOverview(),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: { id: "reservation-1", status: "cancelled" },
      listing: { id: "listing-1", status: "active" },
      eligibility: { can_cancel: false, can_confirm: false },
    },
    financeOps: {
      reservation_id: "reservation-1",
      finance_status: "refund_required",
      issue_flags: {},
    },
    listingSnapshot: null,
    actionPending: null,
  });

  assert.deepEqual(noDecision.financeOps?.allowedStatuses, ["refund_required"]);
  assert.deepEqual(refundRequired.financeOps?.allowedStatuses, ["refund_requested", "deposit_forfeited"]);
});

test("operations loader clears stale selection when filtered overview does not include it", async () => {
  const calls: string[] = [];
  const model = await loadOperationsModel(
    {
      loadAdminOperationsOverview: async () => {
        calls.push("overview");
        return {
          reservations: { items: [], limit: 20, offset: 0 },
          orders: { items: [], limit: 100, offset: 0 },
          payments: { items: [], limit: 100, offset: 0 },
        };
      },
      fetchReservationWorkflowSnapshot: async (reservationId) => {
        calls.push(`reservation:${reservationId}`);
        return {};
      },
      fetchReservationDocumentTracking: async (reservationId) => {
        calls.push(`documents:${reservationId}`);
        return {};
      },
      fetchReservationFinanceOps: async (reservationId) => {
        calls.push(`finance:${reservationId}`);
        return {};
      },
      fetchReservationEventHistory: async (reservationId) => {
        calls.push(`events:${reservationId}`);
        return { items: [] };
      },
      fetchListingWorkflowSnapshot: async (listingId) => {
        calls.push(`listing:${listingId}`);
        return {};
      },
      loadAdminPaymentEvents: async () => ({ items: [], limit: 20, offset: 0 }),
    },
    "stale-reservation-id",
  );

  assert.deepEqual(calls, ["overview"]);
  assert.equal(model.selectedReservationId, null);
  assert.equal(model.reservationSnapshot, null);
  assert.equal(model.documentTracking, null);
  assert.equal(model.financeOps, null);
  assert.deepEqual(model.actions, []);
});

test("operations loader starts independent selected reservation detail requests in parallel", async () => {
  const calls: string[] = [];
  let releaseDetails!: () => void;
  const detailsCanResolve = new Promise<void>((resolve) => {
    releaseDetails = resolve;
  });

  const modelPromise = loadOperationsModel({
    loadAdminOperationsOverview: async () => {
      calls.push("overview");
      return {
        reservations: {
          items: [{ id: "reservation-1", listing_id: "listing-1" }],
          limit: 20,
          offset: 0,
        },
        orders: { items: [], limit: 100, offset: 0 },
        payments: { items: [], limit: 100, offset: 0 },
      };
    },
    fetchReservationWorkflowSnapshot: async (reservationId) => {
      calls.push(`reservation:${reservationId}`);
      await detailsCanResolve;
      return {
        reservation: { id: reservationId, status: "pending" },
        listing: { id: "listing-1", status: "passive" },
      };
    },
    fetchReservationDocumentTracking: async (reservationId) => {
      calls.push(`documents:${reservationId}`);
      await detailsCanResolve;
      return { reservation_id: reservationId };
    },
    fetchReservationFinanceOps: async (reservationId) => {
      calls.push(`finance:${reservationId}`);
      await detailsCanResolve;
      return { reservation_id: reservationId };
    },
    fetchReservationEventHistory: async (reservationId) => {
      calls.push(`events:${reservationId}`);
      await detailsCanResolve;
      return { items: [] };
    },
    fetchListingWorkflowSnapshot: async (listingId) => {
      calls.push(`listing:${listingId}`);
      await detailsCanResolve;
      return { listing: { id: listingId, status: "passive" } };
    },
    loadAdminPaymentEvents: async () => ({ items: [], limit: 20, offset: 0 }),
  });

  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(calls, [
    "overview",
    "reservation:reservation-1",
    "documents:reservation-1",
    "finance:reservation-1",
    "events:reservation-1",
    "listing:listing-1",
  ]);

  releaseDetails();
  const model = await modelPromise;
  assert.equal(model.selectedReservationId, "reservation-1");
});

test("operations view model uses Turkish finance labels even when backend labels are English", () => {
  const model = buildOperationsViewModel({
    overview: createOverview(),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: { id: "reservation-1", status: "cancelled" },
      listing: { id: "listing-1", status: "active" },
      eligibility: { can_cancel: false, can_confirm: false },
    },
    financeOps: {
      reservation_id: "reservation-1",
      finance_status: "refund_required",
      status_label: "Refund required",
      recommended_status: "refund_requested",
      issue_flags: {
        amount_drift: true,
        ownership_drift: true,
        missing_payment: true,
      },
    },
    listingSnapshot: null,
    actionPending: null,
  });

  assert.equal(model.financeOps?.statusLabel, "İade gerekli");
  assert.equal(model.financeOps?.recommendedStatus, "refund_requested");
});

test("operations view model uses Turkish document labels instead of raw backend labels", () => {
  const model = buildOperationsViewModel({
    overview: createOverview(),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: { id: "reservation-1", status: "confirmed" },
      payment: { id: "payment-1", status: "succeeded" },
      listing: { id: "listing-1", status: "passive" },
      eligibility: { can_cancel: false, can_confirm: false },
    },
    documentTracking: {
      reservation_id: "reservation-1",
      document_status: "completed",
      status_label: "Tamamlandi",
    },
    listingSnapshot: null,
    actionPending: null,
  });

  assert.equal(model.documentTracking?.statusLabel, "Tamamlandı");
});

test("operations controller returns Turkish document and finance success messages", async () => {
  const documentResult = await updateOperationsDocumentTracking(
    {
      updateReservationDocumentTracking: async () => undefined,
    } as never,
    {
      selectedReservationId: "reservation-1",
      status: "waiting",
      noteText: "",
    },
  );
  const financeResult = await updateOperationsFinanceOps(
    {
      updateReservationFinanceOps: async () => undefined,
    } as never,
    {
      selectedReservationId: "reservation-1",
      status: "refund_required",
      noteText: "",
    },
  );

  assert.equal(documentResult.message, "Belge takibi güncellendi: Belge bekleniyor");
  assert.equal(financeResult.message, "Finans kararı güncellendi: İade gerekli");
});

test("operations view model maps expired status to Turkish label", () => {
  const model = buildOperationsViewModel({
    overview: createOverview({
      reservations: {
        items: [
          {
            id: "reservation-1",
            listing_id: "listing-1",
            status: "expired",
            move_in_date: "2026-01-01",
            stay_months: 3,
            listing: { id: "listing-1", title: "Test", city: "Ankara", district: "Cankaya" },
          },
        ],
        limit: 20,
        offset: 0,
      },
    }),
    selectedReservationId: "reservation-1",
    reservationSnapshot: {
      reservation: { id: "reservation-1", status: "expired" },
      listing: { id: "listing-1", status: "active" },
      eligibility: { can_cancel: false, can_confirm: false },
    },
    listingSnapshot: null,
    actionPending: null,
  });

  assert.equal(model.rows[0]?.reservationStatus, "S\u00fcresi doldu");
});

function createOverview(overrides: Partial<Parameters<typeof buildOperationsViewModel>[0]["overview"]> = {}) {
  return {
    reservations: {
      items: [
        {
          id: "reservation-1",
          listing_id: "listing-1",
          status: "pending",
          move_in_date: "2026-05-01",
          stay_months: 6,
          listing: {
            id: "listing-1",
            title: "Kadikoy 2+1",
            status: "passive",
            city: "Istanbul",
            district: "Kadikoy",
          },
        },
      ],
      limit: 20,
      offset: 0,
    },
    orders: {
      items: [
        {
          id: "order-1",
          reservation_id: "reservation-1",
          status: "pending",
          total_amount: 25000,
          currency: "TRY",
        },
      ],
      limit: 100,
      offset: 0,
    },
    payments: {
      items: [
        {
          id: "payment-1",
          order_id: "order-1",
          status: "succeeded",
          amount: 25000,
          currency: "TRY",
        },
      ],
      limit: 100,
      offset: 0,
    },
    ...overrides,
  };
}

function reservationRow(id: string, title: string, status: string) {
  return {
    id,
    listing_id: `listing-${id}`,
    status,
    move_in_date: "2026-05-01",
    stay_months: 6,
    listing: {
      id: `listing-${id}`,
      title,
      status: status === "cancelled" ? "active" : "passive",
      city: "Istanbul",
      district: "Kadikoy",
    },
  };
}

function orderRow(id: string, reservationId: string) {
  return {
    id,
    reservation_id: reservationId,
    status: reservationId === "reservation-refund" ? "cancelled" : "completed",
    total_amount: 25000,
    currency: "TRY",
  };
}

function paymentRow(id: string, orderId: string, status: string) {
  return {
    id,
    order_id: orderId,
    status,
    amount: 25000,
    currency: "TRY",
  };
}

function createActionDependencies(overrides: Partial<{
  cancelReservationWorkflow: (reservationId: string, body: { refundDecision: "manual_refund" | "no_refund"; note: string }) => Promise<unknown>;
  confirmReservationWorkflow: (reservationId: string, body: { note: string | null }) => Promise<unknown>;
  reopenListingWorkflow: (listingId: string, body: { reason: string; note: string | null }) => Promise<unknown>;
  updateReservationDocumentTracking: (reservationId: string, body: { status: string; note: string | null }) => Promise<unknown>;
  updateReservationFinanceOps: (reservationId: string, body: { status: string; note: string | null }) => Promise<unknown>;
}> = {}) {
  return {
    cancelReservationWorkflow: async () => ({}),
    confirmReservationWorkflow: async () => ({}),
    reopenListingWorkflow: async () => ({}),
    updateReservationDocumentTracking: async () => ({}),
    updateReservationFinanceOps: async () => ({}),
    ...overrides,
  } as never;
}
