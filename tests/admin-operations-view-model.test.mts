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
      label: "İlanı yeniden aç",
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
            title: "Kadıköy 2+1",
            status: "passive",
            city: "İstanbul",
            district: "Kadıköy",
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
