export type CheckoutCreateRequestBody = {
  contact: {
    documentReadiness: "ready" | "needs_help" | "later";
    email: string | null;
    fullName: string;
    note: string | null;
    occupantFullName: string | null;
    phone: string;
    preferredContactMethod: "phone" | "whatsapp" | "email";
    preferredContactTime: string | null;
  };
  guestCount: number;
  listingId: string;
  mainItems: string[];
  moveInDate: string;
  note: string;
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
const MAX_CONTACT_FULL_NAME_LENGTH = 120;
const MAX_CONTACT_PHONE_LENGTH = 32;
const MAX_CONTACT_EMAIL_LENGTH = 254;
const MAX_CONTACT_PREFERRED_TIME_LENGTH = 120;
const MAX_CONTACT_OCCUPANT_FULL_NAME_LENGTH = 120;
const MIN_CONTACT_FULL_NAME_LENGTH = 2;
const MIN_CONTACT_PHONE_LENGTH = 7;

const CONTACT_PREFERRED_METHOD_VALUES = ["phone", "whatsapp", "email"] as const;
const CONTACT_DOCUMENT_READINESS_VALUES = ["ready", "needs_help", "later"] as const;

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
  if (note.value === null) {
    return validationError("note is required");
  }

  const contact = normalizeContact(row.contact);
  if (!contact.ok) {
    return validationError(contact.error);
  }

  return {
    ok: true,
    body: {
      contact: contact.value,
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

function normalizeContact(
  value: unknown,
):
  | {
    ok: true;
    value: CheckoutCreateRequestBody["contact"];
  }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      ok: false,
      error: "contact is required",
    };
  }

  const row = value as Record<string, unknown>;
  const fullName = normalizeRequiredBoundedString(
    "contact.full_name",
    row.full_name,
    MIN_CONTACT_FULL_NAME_LENGTH,
    MAX_CONTACT_FULL_NAME_LENGTH,
  );
  if (!fullName.ok) {
    return fullName;
  }

  const phone = normalizeRequiredBoundedString(
    "contact.phone",
    row.phone,
    MIN_CONTACT_PHONE_LENGTH,
    MAX_CONTACT_PHONE_LENGTH,
  );
  if (!phone.ok) {
    return phone;
  }

  const preferredMethod = normalizeEnumString(
    "contact.preferred_contact_method",
    row.preferred_contact_method,
    CONTACT_PREFERRED_METHOD_VALUES,
  );
  if (!preferredMethod.ok) {
    return preferredMethod;
  }

  const documentReadiness = normalizeEnumString(
    "contact.document_readiness",
    row.document_readiness,
    CONTACT_DOCUMENT_READINESS_VALUES,
  );
  if (!documentReadiness.ok) {
    return documentReadiness;
  }

  const email = normalizeOptionalBoundedString(
    "contact.email",
    row.email,
    MAX_CONTACT_EMAIL_LENGTH,
    { lowercase: true },
  );
  if (!email.ok) {
    return email;
  }
  if (email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    return {
      ok: false,
      error: "contact.email must be a valid email",
    };
  }

  const preferredContactTime = normalizeOptionalBoundedString(
    "contact.preferred_contact_time",
    row.preferred_contact_time,
    MAX_CONTACT_PREFERRED_TIME_LENGTH,
  );
  if (!preferredContactTime.ok) {
    return preferredContactTime;
  }

  const occupantFullName = normalizeOptionalBoundedString(
    "contact.occupant_full_name",
    row.occupant_full_name,
    MAX_CONTACT_OCCUPANT_FULL_NAME_LENGTH,
  );
  if (!occupantFullName.ok) {
    return occupantFullName;
  }

  const note = normalizeOptionalBoundedString("contact.note", row.note, MAX_NOTE_LENGTH);
  if (!note.ok) {
    return note;
  }

  return {
    ok: true,
    value: {
      fullName: fullName.value,
      phone: phone.value,
      email: email.value,
      preferredContactMethod: preferredMethod.value,
      preferredContactTime: preferredContactTime.value,
      occupantFullName: occupantFullName.value,
      documentReadiness: documentReadiness.value,
      note: note.value,
    },
  };
}

function normalizeRequiredBoundedString(
  fieldName: string,
  value: unknown,
  minLength: number,
  maxLength: number,
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== "string") {
    return {
      ok: false,
      error: `${fieldName} is required`,
    };
  }

  const normalized = value.trim();
  if (normalized.length < minLength) {
    return {
      ok: false,
      error: `${fieldName} is required`,
    };
  }

  if (normalized.length > maxLength) {
    return {
      ok: false,
      error: `${fieldName} is too long`,
    };
  }

  return {
    ok: true,
    value: normalized,
  };
}

function normalizeOptionalBoundedString(
  fieldName: string,
  value: unknown,
  maxLength: number,
  options: { lowercase?: boolean } = {},
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === undefined || value === null) {
    return { ok: true, value: null };
  }

  if (typeof value !== "string") {
    return {
      ok: false,
      error: `${fieldName} must be a string`,
    };
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return { ok: true, value: null };
  }

  if (normalized.length > maxLength) {
    return {
      ok: false,
      error: `${fieldName} is too long`,
    };
  }

  return {
    ok: true,
    value: options.lowercase ? normalized.toLowerCase() : normalized,
  };
}

function normalizeEnumString<const T extends readonly string[]>(
  fieldName: string,
  value: unknown,
  values: T,
): { ok: true; value: T[number] } | { ok: false; error: string } {
  if (typeof value !== "string") {
    return {
      ok: false,
      error: `${fieldName} must be one of ${values.join(", ")}`,
    };
  }

  const normalized = value.trim().toLowerCase();
  if (!(values as readonly string[]).includes(normalized)) {
    return {
      ok: false,
      error: `${fieldName} must be one of ${values.join(", ")}`,
    };
  }

  return {
    ok: true,
    value: normalized as T[number],
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
