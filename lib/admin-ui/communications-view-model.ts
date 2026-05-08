// Phase D: Communication Admin view model.
// Maps raw chatwoot_conversations rows (with joined profiles/listings) into
// admin-safe overview rows. No raw payload fields leak into the output.

export type ChatwootConversationStatus = "provisioning" | "ready" | "failed";

export type RawChatwootConversation = {
  id: string;
  user_id: string;
  listing_id: string;
  status: ChatwootConversationStatus;
  chatwoot_source_id: string | null;
  chatwoot_conversation_id: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    full_name?: string | null;
    email?: string | null;
  } | null;
  listings?: {
    id: string;
    title: string;
    city?: string | null;
    district?: string | null;
  } | null;
};

export type CommunicationsOverviewRow = {
  conversationId: string;
  userId: string;
  listingId: string;
  listingTitle: string;
  locationLabel: string | null;
  userName: string | null;
  userEmail: string | null;
  status: ChatwootConversationStatus;
  failureReason: string | null;
  chatwootConversationId: string | null;
  chatwootOpenHref: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationsViewModel = {
  rows: CommunicationsOverviewRow[];
};

export type CommunicationsViewModelInput = {
  conversations: RawChatwootConversation[];
  chatwootWebBaseUrl?: string | null;
  chatwootAccountId?: string | null;
};

export function buildCommunicationsViewModel(
  input: CommunicationsViewModelInput,
): CommunicationsViewModel {
  return {
    rows: input.conversations.map((raw) => buildOverviewRow(raw, input)),
  };
}

export type BuildChatwootOpenHrefInput = {
  status: ChatwootConversationStatus;
  providerConversationId: string | null;
  chatwootWebBaseUrl?: string | null;
  chatwootAccountId?: string | null;
};

export function buildChatwootOpenHref(
  input: BuildChatwootOpenHrefInput,
): string | null {
  if (input.status !== "ready") {
    return null;
  }

  const providerConversationId = nonEmptyString(input.providerConversationId);
  const accountId = nonEmptyString(input.chatwootAccountId);
  const origin = normalizeHttpOrigin(input.chatwootWebBaseUrl);
  if (!providerConversationId || !accountId || !origin) {
    return null;
  }

  return [
    origin,
    "/app/accounts/",
    encodeURIComponent(accountId),
    "/conversations/",
    encodeURIComponent(providerConversationId),
  ].join("");
}

function buildOverviewRow(
  raw: RawChatwootConversation,
  input: CommunicationsViewModelInput,
): CommunicationsOverviewRow {
  const city = nonEmptyString(raw.listings?.city);
  const district = nonEmptyString(raw.listings?.district);
  const locationParts = [city, district].filter((value): value is string => value !== null);
  const locationLabel = locationParts.length > 0 ? locationParts.join(" / ") : null;
  const chatwootConversationId = nonEmptyString(raw.chatwoot_conversation_id);

  return {
    conversationId: raw.id,
    userId: raw.user_id,
    listingId: raw.listing_id,
    listingTitle: nonEmptyString(raw.listings?.title) ?? "Bilinmeyen İlan",
    locationLabel,
    userName: nonEmptyString(raw.profiles?.full_name),
    userEmail: nonEmptyString(raw.profiles?.email),
    status: raw.status,
    failureReason: nonEmptyString(raw.failure_reason),
    chatwootConversationId,
    chatwootOpenHref: buildChatwootOpenHref({
      status: raw.status,
      providerConversationId: chatwootConversationId,
      chatwootWebBaseUrl: input.chatwootWebBaseUrl,
      chatwootAccountId: input.chatwootAccountId,
    }),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeHttpOrigin(value: unknown): string | null {
  const raw = nonEmptyString(value);
  if (!raw) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  if (parsed.username || parsed.password) {
    return null;
  }

  return parsed.origin;
}
