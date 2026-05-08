import crypto from "node:crypto";

export type ChatwootConfig = {
  baseUrl: string;
  inboxIdentifier: string;
  hmacToken: string;
};

export type ResolveChatwootConfigResult =
  | { ok: true; value: ChatwootConfig }
  | { ok: false; error: string };

export type ChatwootClientResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string };

type JsonPrimitive = string | number | boolean | null;
type JsonObject = { [key: string]: JsonPrimitive | JsonObject | JsonPrimitive[] };
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type CreateChatwootContactInput = {
  customAttributes?: Record<string, JsonPrimitive>;
  email?: string | null;
  identifier: string;
  name?: string | null;
  phone?: string | null;
};

export type CreateChatwootConversationInput = {
  customAttributes?: Record<string, JsonPrimitive>;
  sourceId: string;
};

export type ChatwootConversationReference = {
  conversationId: string;
  sourceId: string;
};

export type ChatwootMessagePagination = {
  limit: number;
  offset: number;
};

export type ListChatwootMessagesInput = ChatwootConversationReference & {
  pagination?: ChatwootMessagePagination;
};

export type CreateChatwootMessageInput = ChatwootConversationReference & {
  content: string;
};

export function buildChatwootContactIdentifier(userId: string): string {
  return `user:${userId.trim().toLowerCase()}`;
}

export function buildChatwootIdentifierHash(identifier: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(identifier, "utf8")
    .digest("hex");
}

export function resolveChatwootConfigFromEnv(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): ResolveChatwootConfigResult {
  const baseUrl = asNonEmptyString(env.CHATWOOT_BASE_URL);
  const inboxIdentifier = asNonEmptyString(env.CHATWOOT_INBOX_IDENTIFIER);
  const hmacToken = asNonEmptyString(env.CHATWOOT_HMAC_TOKEN);

  if (!baseUrl || !inboxIdentifier || !hmacToken) {
    return {
      ok: false,
      error: "Chatwoot configuration is incomplete",
    };
  }

  const normalizedBaseUrl = normalizeHttpOrigin(baseUrl);
  if (!normalizedBaseUrl) {
    return {
      ok: false,
      error: "CHATWOOT_BASE_URL must be an absolute http(s) URL",
    };
  }

  return {
    ok: true,
    value: {
      baseUrl: normalizedBaseUrl,
      inboxIdentifier,
      hmacToken,
    },
  };
}

export function createChatwootClient(
  config: ChatwootConfig,
  fetchImpl: FetchLike = fetch,
) {
  const requestJson = async <T>(
    path: string,
    init: RequestInit,
    failureMessage: string,
    parseValue: (payload: unknown) => T | null,
  ): Promise<ChatwootClientResult<T>> => {
    let response: Response;
    try {
      response = await fetchImpl(`${config.baseUrl}${path}`, {
        ...init,
        headers: buildJsonHeaders(init.headers),
      });
    } catch {
      return {
        ok: false,
        status: 502,
        error: failureMessage,
      };
    }

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        status: 502,
        error: failureMessage,
      };
    }

    const value = parseValue(payload);
    if (value === null) {
      return {
        ok: false,
        status: 502,
        error: failureMessage,
      };
    }

    return {
      ok: true,
      value,
    };
  };

  return {
    createContact(input: CreateChatwootContactInput): Promise<ChatwootClientResult<{ sourceId: string }>> {
      const body: JsonObject = {
        identifier: input.identifier,
        identifier_hash: buildChatwootIdentifierHash(input.identifier, config.hmacToken),
      };
      addOptionalString(body, "email", input.email);
      addOptionalString(body, "name", input.name);
      addOptionalString(body, "phone_number", input.phone);
      if (input.customAttributes) {
        body.custom_attributes = input.customAttributes;
      }

      return requestJson(
        `/public/api/v1/inboxes/${encodePathSegment(config.inboxIdentifier)}/contacts`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        "Chatwoot contact request failed",
        (payload) => {
          const sourceId = readStringPath(payload, ["source_id"])
            ?? readStringPath(payload, ["contact", "source_id"]);
          return sourceId ? { sourceId } : null;
        },
      );
    },

    createConversation(
      input: CreateChatwootConversationInput,
    ): Promise<ChatwootClientResult<{ conversationId: string }>> {
      const body: JsonObject = {};
      if (input.customAttributes) {
        body.custom_attributes = input.customAttributes;
      }

      return requestJson(
        [
          `/public/api/v1/inboxes/${encodePathSegment(config.inboxIdentifier)}`,
          `/contacts/${encodePathSegment(input.sourceId)}`,
          "/conversations",
        ].join(""),
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        "Chatwoot conversation request failed",
        (payload) => {
          const conversationId = readStringOrNumberPath(payload, ["id"])
            ?? readStringOrNumberPath(payload, ["conversation", "id"])
            ?? readStringOrNumberPath(payload, ["conversation_id"]);
          return conversationId ? { conversationId } : null;
        },
      );
    },

    listMessages(input: ListChatwootMessagesInput): Promise<ChatwootClientResult<unknown[]>> {
      return requestJson(
        buildConversationMessagesPath(config.inboxIdentifier, input, input.pagination),
        {
          method: "GET",
        },
        "Chatwoot messages request failed",
        (payload) => {
          if (Array.isArray(payload)) {
            return payload;
          }
          const messages = readUnknownPath(payload, ["payload"]);
          return Array.isArray(messages) ? messages : null;
        },
      );
    },

    createIncomingMessage(input: CreateChatwootMessageInput): Promise<ChatwootClientResult<unknown>> {
      const body: JsonObject = {
        content: input.content,
        message_type: "incoming",
      };

      return requestJson(
        buildConversationMessagesPath(config.inboxIdentifier, input),
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        "Chatwoot message request failed",
        (payload) => payload,
      );
    },
  };
}

function buildConversationMessagesPath(
  inboxIdentifier: string,
  input: ChatwootConversationReference,
  pagination?: ChatwootMessagePagination,
): string {
  const path = [
    `/public/api/v1/inboxes/${encodePathSegment(inboxIdentifier)}`,
    `/contacts/${encodePathSegment(input.sourceId)}`,
    `/conversations/${encodePathSegment(input.conversationId)}`,
    "/messages",
  ].join("");

  if (!pagination) {
    return path;
  }

  const params = new URLSearchParams({
    limit: String(pagination.limit),
    offset: String(pagination.offset),
  });
  return `${path}?${params.toString()}`;
}

function buildJsonHeaders(input: HeadersInit | undefined): Headers {
  const headers = new Headers(input);
  headers.set("accept", "application/json");
  headers.set("content-type", "application/json");
  return headers;
}

function addOptionalString(body: JsonObject, key: string, value: string | null | undefined): void {
  const normalized = asNonEmptyString(value);
  if (normalized) {
    body[key] = normalized;
  }
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeHttpOrigin(value: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(value);
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

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

function readStringPath(value: unknown, path: string[]): string | null {
  const found = readUnknownPath(value, path);
  return asNonEmptyString(found);
}

function readStringOrNumberPath(value: unknown, path: string[]): string | null {
  const found = readUnknownPath(value, path);
  if (typeof found === "number" && Number.isFinite(found)) {
    return String(found);
  }
  return asNonEmptyString(found);
}

function readUnknownPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const part of path) {
    if (!isRecord(current)) {
      return null;
    }
    current = current[part];
  }
  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
