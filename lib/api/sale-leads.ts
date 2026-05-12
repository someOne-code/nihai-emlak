import { apiFetch } from "./client.ts";

export type SaleLeadFormInput = {
  listingId: string;
  contactName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  message: string;
};

export type SaleLeadPayload = {
  listing_id: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  message: string;
};

export type SaleLeadCreateResponse = {
  lead: {
    id: string;
    listingId: string;
    status: "new";
  };
};

export function buildSaleLeadPayload(input: SaleLeadFormInput): SaleLeadPayload {
  return {
    listing_id: input.listingId.trim(),
    contact_name: input.contactName.trim(),
    contact_email: normalizeOptionalEmail(input.contactEmail),
    contact_phone: normalizeOptionalText(input.contactPhone),
    message: input.message.trim(),
  };
}

export async function createSaleLead(
  input: SaleLeadFormInput,
): Promise<SaleLeadCreateResponse> {
  return apiFetch<SaleLeadCreateResponse>("/api/sale-leads", {
    method: "POST",
    body: JSON.stringify(buildSaleLeadPayload(input)),
  });
}

function normalizeOptionalEmail(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalText(value);
  return normalized ? normalized.toLowerCase() : null;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
