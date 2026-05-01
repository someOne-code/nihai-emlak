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
  const snapshot = targetListingId
    ? await dependencies.fetchAdminListingSnapshot(targetListingId)
    : null;

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
  const snapshot = targetListingId && targetListingId === input.listingId
    ? await dependencies.fetchAdminListingSnapshot(targetListingId)
    : null;

  return buildAdminListingsViewModel({
    list: input.list,
    selectedListingId: targetListingId,
    snapshot,
  });
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
