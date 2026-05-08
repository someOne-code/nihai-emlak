export type SaleLeadStatus =
  | "new"
  | "called"
  | "meeting_planned"
  | "not_interested"
  | "closed";

export type RawSaleLead = {
  id: string;
  listing_id: string;
  user_id: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  message: string;
  status: SaleLeadStatus;
  created_at: string;
  updated_at: string;
  chatwoot_conversation_id: string | null;
  listings?: {
    id: string;
    title?: string | null;
    city?: string | null;
    district?: string | null;
    type?: string | null;
  } | null;
  profiles?: {
    id: string;
    full_name?: string | null;
    email?: string | null;
  } | null;
};

export type SaleLeadsOverviewRow = {
  leadId: string;
  listingId: string;
  userId: string;
  listingTitle: string;
  locationLabel: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  messagePreview: string;
  status: SaleLeadStatus;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
  conversationHref: string | null;
};

export type SaleLeadsViewModel = {
  rows: SaleLeadsOverviewRow[];
  counts: Record<SaleLeadStatus, number>;
};

export type SaleLeadsViewModelInput = {
  leads: RawSaleLead[];
};

export const SALE_LEAD_STATUS_LABELS: Record<SaleLeadStatus, string> = {
  new: "Yeni",
  called: "Arandi",
  meeting_planned: "Gorusme Planlandi",
  not_interested: "Ilgilenmiyor",
  closed: "Kapandi",
};

export function buildSaleLeadsViewModel(
  input: SaleLeadsViewModelInput,
): SaleLeadsViewModel {
  const rows = input.leads.map(buildOverviewRow);
  return {
    rows,
    counts: rows.reduce<Record<SaleLeadStatus, number>>(
      (acc, row) => {
        acc[row.status] += 1;
        return acc;
      },
      {
        new: 0,
        called: 0,
        meeting_planned: 0,
        not_interested: 0,
        closed: 0,
      },
    ),
  };
}

function buildOverviewRow(raw: RawSaleLead): SaleLeadsOverviewRow {
  const city = nonEmptyString(raw.listings?.city);
  const district = nonEmptyString(raw.listings?.district);
  const locationParts = [city, district].filter((value): value is string => value !== null);

  return {
    leadId: raw.id,
    listingId: raw.listing_id,
    userId: raw.user_id,
    listingTitle: nonEmptyString(raw.listings?.title) ?? "Bilinmeyen Ilan",
    locationLabel: locationParts.length > 0 ? locationParts.join(" / ") : "Konum yok",
    contactName: nonEmptyString(raw.contact_name) ?? nonEmptyString(raw.profiles?.full_name),
    contactEmail: nonEmptyString(raw.contact_email) ?? nonEmptyString(raw.profiles?.email),
    contactPhone: nonEmptyString(raw.contact_phone),
    messagePreview: previewText(raw.message, 140),
    status: raw.status,
    statusLabel: SALE_LEAD_STATUS_LABELS[raw.status],
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    conversationHref: buildConversationHref(raw.chatwoot_conversation_id),
  };
}

function buildConversationHref(conversationId: string | null): string | null {
  const normalized = nonEmptyString(conversationId);
  return normalized ? `/admin/communications?conversation=${encodeURIComponent(normalized)}` : null;
}

function previewText(value: unknown, maxLength: number): string {
  const normalized = nonEmptyString(value) ?? "";
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
