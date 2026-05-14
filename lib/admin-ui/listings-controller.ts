// Phase 8.5: orchestration helpers for /admin/listings.
//
// Loaders fetch the admin listing list and snapshot via the typed
// client and feed the results through the view-model so the UI does
// not touch raw RPC payloads directly.

import {
  fetchAdminListingsList,
  fetchAdminListingSnapshot,
  type AdminListingsListFilters,
  type AdminListingsListResponse,
} from "./listings-client.ts";
import {
  buildAdminListingsViewModel,
  type AdminListingsViewModel,
} from "./listings-view-model.ts";

export type AdminListingsLoaderDependencies = {
  fetchAdminListingsList: (
    filters: AdminListingsListFilters,
  ) => Promise<AdminListingsListResponse>;
  fetchAdminListingSnapshot: (listingId: string) => Promise<unknown>;
};

export type AdminListingsSelectDependencies = {
  fetchAdminListingSnapshot: (listingId: string) => Promise<unknown>;
};

export type AdminListingsLoadInput = {
  selectedListingId: string | null;
  filters?: AdminListingsListFilters;
};

export type AdminListingsMutationRefreshInput = {
  selectedListingId: string | null;
  cachedList?: AdminListingsListResponse | null;
  filters?: AdminListingsListFilters;
  mutationSnapshot?: unknown;
  selectFirstWhenMissing?: boolean;
};

export type AdminListingsMutationRefreshResult = {
  list: AdminListingsListResponse;
  model: AdminListingsViewModel;
};

export type AdminListingsSelectInput = {
  list: AdminListingsListResponse;
  listingId: string;
};

const DEFAULT_LOADER_DEPENDENCIES: AdminListingsLoaderDependencies = {
  fetchAdminListingsList,
  fetchAdminListingSnapshot,
};

const DEFAULT_SELECT_DEPENDENCIES: AdminListingsSelectDependencies = {
  fetchAdminListingSnapshot,
};

export async function loadAdminListingsModel(
  dependencies: AdminListingsLoaderDependencies = DEFAULT_LOADER_DEPENDENCIES,
  input: AdminListingsLoadInput = { selectedListingId: null },
): Promise<AdminListingsViewModel> {
  const list = await dependencies.fetchAdminListingsList(input.filters ?? {});
  const targetListingId = resolveTargetListingId(list, input.selectedListingId);
  let snapshot: unknown = null;
  if (targetListingId) {
    try {
      snapshot = await dependencies.fetchAdminListingSnapshot(targetListingId);
    } catch {
      // Snapshot failure is non-critical; list still loads.
    }
  }

  return buildAdminListingsViewModel({
    list,
    selectedListingId: targetListingId,
    snapshot,
  });
}

export async function selectAdminListing(
  dependencies: AdminListingsSelectDependencies = DEFAULT_SELECT_DEPENDENCIES,
  input: AdminListingsSelectInput,
): Promise<AdminListingsViewModel> {
  const targetListingId = resolveTargetListingId(input.list, input.listingId);
  let snapshot: unknown = null;
  if (targetListingId && targetListingId === input.listingId) {
    try {
      snapshot = await dependencies.fetchAdminListingSnapshot(targetListingId);
    } catch {
      // Snapshot failure is non-critical; selection still updates.
    }
  }

  return buildAdminListingsViewModel({
    list: input.list,
    selectedListingId: targetListingId,
    snapshot,
  });
}

export async function refreshAdminListingsModelAfterMutation(
  dependencies: AdminListingsLoaderDependencies = DEFAULT_LOADER_DEPENDENCIES,
  input: AdminListingsMutationRefreshInput,
): Promise<AdminListingsMutationRefreshResult> {
  const list =
    input.cachedList && snapshotMatchesListing(input.mutationSnapshot, input.selectedListingId)
      ? applyMutationSnapshotToList(input.cachedList, input.mutationSnapshot)
      : await dependencies.fetchAdminListingsList(input.filters ?? {});
  const targetListingId = resolveTargetListingId(list, input.selectedListingId);
  let snapshot: unknown = null;

  if (targetListingId) {
    if (snapshotMatchesListing(input.mutationSnapshot, targetListingId)) {
      snapshot = input.mutationSnapshot;
    } else {
      try {
        snapshot = await dependencies.fetchAdminListingSnapshot(targetListingId);
      } catch {
        // Snapshot failure is non-critical; list still refreshes.
      }
    }
  }

  return {
    list,
    model: buildAdminListingsViewModel({
      list,
      selectedListingId: targetListingId,
      snapshot,
      selectFirstWhenMissing: input.selectFirstWhenMissing,
    }),
  };
}

function resolveTargetListingId(
  list: AdminListingsListResponse,
  candidate: string | null,
): string | null {
  const candidateString =
    typeof candidate === "string" && candidate.trim().length > 0 ? candidate.trim() : null;

  const items = list.items.filter(
    (item): item is Record<string, unknown> =>
      typeof item === "object" && item !== null && !Array.isArray(item),
  );

  if (items.length === 0) {
    return null;
  }

  if (candidateString) {
    const match = items.find((item) => asNonEmptyString(item.id) === candidateString);
    if (match) {
      return candidateString;
    }
  }

  return asNonEmptyString(items[0].id);
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

function snapshotMatchesListing(snapshot: unknown, listingId: string | null): boolean {
  if (!listingId) {
    return false;
  }
  if (typeof snapshot !== "object" || snapshot === null || Array.isArray(snapshot)) {
    return false;
  }

  const listing = (snapshot as Record<string, unknown>).listing;
  if (typeof listing !== "object" || listing === null || Array.isArray(listing)) {
    return false;
  }

  return asNonEmptyString((listing as Record<string, unknown>).id) === listingId;
}

function applyMutationSnapshotToList(
  list: AdminListingsListResponse,
  snapshot: unknown,
): AdminListingsListResponse {
  if (typeof snapshot !== "object" || snapshot === null || Array.isArray(snapshot)) {
    return list;
  }

  const snapshotRecord = snapshot as Record<string, unknown>;
  const listing = snapshotRecord.listing;
  if (typeof listing !== "object" || listing === null || Array.isArray(listing)) {
    return list;
  }

  const listingRecord = listing as Record<string, unknown>;
  const listingId = asNonEmptyString(listingRecord.id);
  if (!listingId) {
    return list;
  }

  return {
    ...list,
    items: list.items.map((item) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        return item;
      }

      const current = item as Record<string, unknown>;
      if (asNonEmptyString(current.id) !== listingId) {
        return item;
      }

      return {
        ...current,
        id: listingRecord.id,
        type: listingRecord.type,
        status: listingRecord.status,
        title: listingRecord.title,
        slug: listingRecord.slug,
        city: listingRecord.city,
        district: listingRecord.district,
        price: listingRecord.price,
        currency: listingRecord.currency,
        is_furnished: listingRecord.is_furnished,
        image_count: pickArrayLength(snapshotRecord.images, current.image_count),
        main_item_count: pickArrayLength(snapshotRecord.main_item_options, current.main_item_count),
        service_option_count: pickArrayLength(
          snapshotRecord.service_options,
          current.service_option_count,
        ),
        is_checkout_ready: pickCheckoutReady(
          snapshotRecord.checkout_eligibility,
          current.is_checkout_ready,
        ),
        created_at: listingRecord.created_at,
        updated_at: listingRecord.updated_at,
      };
    }),
  };
}

function pickArrayLength(value: unknown, fallback: unknown): unknown {
  return Array.isArray(value) ? value.length : fallback;
}

function pickCheckoutReady(value: unknown, fallback: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fallback;
  }

  const ready = (value as Record<string, unknown>).is_checkout_ready;
  return typeof ready === "boolean" ? ready : fallback;
}
