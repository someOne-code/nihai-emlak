import {
  AdminSaleLeadsClientError,
  loadAdminSaleLeadsOverview,
  updateSaleLeadStatus,
  type AdminSaleLeadsClientOptions,
} from "./sale-leads-client.ts";
import type { SaleLeadStatus } from "./sale-leads-view-model.ts";
import {
  buildSaleLeadsViewModel,
  type SaleLeadsViewModel,
} from "./sale-leads-view-model.ts";

export type SaleLeadsLoaderDependencies = AdminSaleLeadsClientOptions;

export type SaleLeadsLoadResult =
  | { ok: true; viewModel: SaleLeadsViewModel }
  | { ok: false; error: string; status: number };

export async function loadSaleLeadsModel(
  options: SaleLeadsLoaderDependencies = {},
): Promise<SaleLeadsLoadResult> {
  try {
    const overview = await loadAdminSaleLeadsOverview(options);
    return {
      ok: true,
      viewModel: buildSaleLeadsViewModel(overview),
    };
  } catch (error) {
    if (error instanceof AdminSaleLeadsClientError) {
      return { ok: false, error: error.message, status: error.status };
    }
    return { ok: false, error: "Satis leadleri yuklenemedi", status: 0 };
  }
}

export type SaleLeadUpdateResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

export async function updateSaleLeadStatusFromController(
  leadId: string,
  status: SaleLeadStatus,
  note: string | null,
  options: SaleLeadsLoaderDependencies = {},
): Promise<SaleLeadUpdateResult> {
  try {
    await updateSaleLeadStatus(leadId, status, note, options);
    return { ok: true };
  } catch (error) {
    if (error instanceof AdminSaleLeadsClientError) {
      return { ok: false, error: error.message, status: error.status };
    }
    return { ok: false, error: "Satis leadi guncellenemedi", status: 0 };
  }
}
