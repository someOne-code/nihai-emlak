export type CheckoutCreateRequestBody = {
  guestCount: number;
  listingId: string;
  mainItems: string[];
  moveInDate: string;
  note: string | null;
  serviceItems: string[];
  stayMonths: number;
};

export type CheckoutCreateParseResult =
  | { ok: true; body: CheckoutCreateRequestBody }
  | { ok: false; status: number; error: string };

const FINANCIAL_CLIENT_FIELDS = new Set([
  "amount",
  "currency",
  "price",
  "total",
  "total_amount",
]);

const MAX_ITEM_COUNT = 20;
const MAX_ITEM_CODE_LENGTH = 64;
const MAX_NOTE_LENGTH = 1000;

export function parseCheckoutCreateRequestBody(payload: unknown): CheckoutCreateParseResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return validationError("Invalid checkout create request body");
  }

  const row = payload as Record<string, unknown>;
  if (hasClientSuppliedFinancialField(row)) {
    return validationError("Client-supplied totals are not accepted");
  }

  const listingId = asUuid(row.listing_id);
  if (!listingId) {
    return validationError("listing_id must be a UUID");
  }

  const moveInDate = asIsoDate(row.move_in_date);
  if (!moveInDate) {
    return validationError("move_in_date must be an ISO date");
  }

  const stayMonths = asInteger(row.stay_months);
  if (stayMonths === null || stayMonths < 1 || stayMonths > 12) {
    return validationError("stay_months must be between 1 and 12");
  }

  const guestCount = asInteger(row.guest_count);
  if (guestCount === null || guestCount < 1) {
    return validationError("guest_count must be a positive integer");
  }

  const mainItems = normalizeItemList("main_items", row.main_items);
  if (!mainItems.ok) {
    return validationError(mainItems.error);
  }

  if (mainItems.items.length === 0) {
    return validationError("main_items must include at least one item");
  }

  if (hasDuplicates(mainItems.items)) {
    return validationError("main_items must not contain duplicates");
  }

  const serviceItems = normalizeItemList("service_items", row.service_items, { allowMissing: true });
  if (!serviceItems.ok) {
    return validationError(serviceItems.error);
  }

  if (hasDuplicates(serviceItems.items)) {
    return validationError("service_items must not contain duplicates");
  }

  const note = normalizeNote(row.note);
  if (!note.ok) {
    return validationError(note.error);
  }

  return {
    ok: true,
    body: {
      guestCount,
      listingId,
      mainItems: mainItems.items,
      moveInDate,
      note: note.value,
      serviceItems: serviceItems.items,
      stayMonths,
    },
  };
}

function validationError(error: string): CheckoutCreateParseResult {
  return {
    ok: false,
    status: 400,
    error,
  };
}

function hasClientSuppliedFinancialField(row: Record<string, unknown>): boolean {
  return Object.keys(row).some((key) => FINANCIAL_CLIENT_FIELDS.has(key));
}

function normalizeItemList(
  fieldName: string,
  value: unknown,
  options: { allowMissing?: boolean } = {},
):
  | { ok: true; items: string[] }
  | { ok: false; error: string } {
  if (value === undefined && options.allowMissing) {
    return { ok: true, items: [] };
  }

  if (!Array.isArray(value)) {
    return {
      ok: false,
      error: `${fieldName} must be an array`,
    };
  }

  if (value.length > MAX_ITEM_COUNT) {
    return {
      ok: false,
      error: `${fieldName} has too many items`,
    };
  }

  const items: string[] = [];
  for (const item of value) {
    const normalized = asItemCode(item);
    if (!normalized) {
      return {
        ok: false,
        error: `${fieldName} must contain non-empty item codes`,
      };
    }

    items.push(normalized);
  }

  return { ok: true, items };
}

function normalizeNote(value: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }

  if (typeof value !== "string") {
    return {
      ok: false,
      error: "note must be a string",
    };
  }

  const normalized = value.trim();
  if (normalized.length > MAX_NOTE_LENGTH) {
    return {
      ok: false,
      error: "note is too long",
    };
  }

  return {
    ok: true,
    value: normalized.length === 0 ? null : normalized,
  };
}

function asItemCode(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized.length === 0
    || normalized.length > MAX_ITEM_CODE_LENGTH
    || !/^[a-z0-9][a-z0-9_-]*$/.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

function asInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }

  return value;
}

function asIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const normalized = parsed.toISOString().slice(0, 10);
  return normalized === value ? value : null;
}

function asUuid(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    return null;
  }

  return normalized.toLowerCase();
}

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}
