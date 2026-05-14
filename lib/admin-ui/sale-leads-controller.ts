import {
  AdminSaleLeadsClientError,
  loadAdminSaleLeadsOverview,
  updateSaleLeadStatus,
  type AdminSaleLeadsClientOptions,
} from "./sale-leads-client.ts";
import type {
  SaleLeadsOverviewRow,
  SaleLeadStatus,
} from "./sale-leads-view-model.ts";
import {
  SALE_LEAD_STATUS_LABELS,
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
  | { ok: true; lead: unknown }
  | { ok: false; error: string; status: number };

export async function updateSaleLeadStatusFromController(
  leadId: string,
  status: SaleLeadStatus,
  note: string | null,
  options: SaleLeadsLoaderDependencies = {},
): Promise<SaleLeadUpdateResult> {
  try {
    const data = await updateSaleLeadStatus(leadId, status, note, options);
    return { ok: true, lead: extractMutationLead(data) };
  } catch (error) {
    if (error instanceof AdminSaleLeadsClientError) {
      return { ok: false, error: error.message, status: error.status };
    }
    return { ok: false, error: "Satis leadi guncellenemedi", status: 0 };
  }
}

export function applySaleLeadStatusMutation(
  rows: SaleLeadsOverviewRow[],
  lead: unknown,
  fallbackStatus: SaleLeadStatus,
): SaleLeadsOverviewRow[] {
  const record = isRecord(lead) ? lead : {};
  const leadId = asString(record.id);
  const status = asSaleLeadStatus(record.status) ?? fallbackStatus;
  const updatedAt = asString(record.updated_at);

  return rows.map((row) => {
    if (leadId === null || row.leadId !== leadId) {
      return row;
    }

    return {
      ...row,
      status,
      statusLabel: SALE_LEAD_STATUS_LABELS[status],
      updatedAt: updatedAt ?? row.updatedAt,
    };
  });
}

function extractMutationLead(data: unknown): unknown {
  if (!isRecord(data)) {
    return data;
  }
  return "lead" in data ? data.lead : data;
}

function asSaleLeadStatus(value: unknown): SaleLeadStatus | null {
  if (typeof value !== "string") {
    return null;
  }
  return value in SALE_LEAD_STATUS_LABELS ? (value as SaleLeadStatus) : null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
