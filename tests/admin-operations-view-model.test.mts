import assert from "node:assert/strict";
import test from "node:test";

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
      label: "Rezervasyonu iptal et",
      enabled: false,
      disabledReason: "Backend snapshot bu aksiyona izin vermiyor.",
    },
    {
      id: "confirm",
      label: "Rezervasyonu onayla",
      enabled: false,
      disabledReason: "Backend snapshot bu aksiyona izin vermiyor.",
    },
    {
      id: "reopen",
      label: "Ilani yeniden ac",
      enabled: false,
      disabledReason: "Backend snapshot bu aksiyona izin vermiyor.",
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
        disabledReason: "Islem devam ederken yeni aksiyon baslatilamaz.",
      },
      {
        id: "confirm",
        enabled: false,
        disabledReason: "Islem devam ederken yeni aksiyon baslatilamaz.",
      },
      {
        id: "reopen",
        enabled: false,
        disabledReason: "Islem devam ederken yeni aksiyon baslatilamaz.",
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
      order: "Tamamlandi",
      payment: "Basarili",
    },
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
        can_cancel_reason: "Odeme henuz basarili degil.",
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
        disabledReason: "Odeme henuz basarili degil.",
      },
      {
        id: "confirm",
        enabled: false,
        disabledReason: "Bu ilan icin baska tamamlanmis rezervasyon var.",
      },
      {
        id: "reopen",
        enabled: false,
        disabledReason: "Ilan durumu bu islem icin uygun degil.",
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
      "Backend snapshot bu aksiyona izin vermiyor.",
      "Backend snapshot bu aksiyona izin vermiyor.",
      "Backend snapshot bu aksiyona izin vermiyor.",
    ],
  );
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
