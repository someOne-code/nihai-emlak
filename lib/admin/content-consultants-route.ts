// Phase 9A Task 6: Consultants content admin route handler.
//
// Uses Payload Local API behind the Next.js route boundary.
//
// Body-parsing logic lives in content-consultants-parsers.ts (pure, side-effect-free).
// This handler delegates to those parsers; the two modules must stay in sync.
//
// Known pre-existing TS typecheck issue (out of scope for Task 6, tracked for Task 7):
//   Line with `page: result.page` — Payload PaginatedDocs types `page` as
//   `number | undefined`, but ConsultantListDTO requires `number`. Fix is a
//   non-null assertion or explicit fallback; will be resolved in Task 7 handler cleanup.

import { getPayload } from "payload";
import configPromise from "@payload-config";

import {
  guardContentAdminRequest,
  jsonError,
  jsonResponse,
  validateContentAdminJsonEnvelope,
  validateContentAdminOrigin,
} from "./content-shared";
import type { ContentAdminRouteDependencies } from "./content-shared";
import {
  parseConsultantCreateBodyForTest as parseConsultantCreateBody,
  parseConsultantUpdateBodyForTest as parseConsultantUpdateBody,
  type ConsultantCreateInput,
  type ConsultantUpdateInput,
} from "./content-consultants-parsers";

// ── DTO types ──────────────────────────────────────────────────────────────

export type ConsultantDTO = {
  id: string;
  fullName: string;
  slug: string;
  title: string | null;
  photoUrl: string | null;
  shortBio: string | null;
  phone: string | null;
  email: string | null;
  whatsappUrl: string | null;
  linkedinUrl: string | null;
  isPublished: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ConsultantListDTO = {
  items: ConsultantDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// ConsultantCreateInput and ConsultantUpdateInput are re-exported from the parsers module.
export type { ConsultantCreateInput, ConsultantUpdateInput };

// ── Payload document shape ─────────────────────────────────────────────────

type PayloadConsultantDoc = {
  id: number | string;
  fullName: string;
  slug: string;
  title?: string | null;
  photoUrl?: string | null;
  shortBio?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsappUrl?: string | null;
  linkedinUrl?: string | null;
  isPublished?: boolean;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
};

// ── DTO mappers ────────────────────────────────────────────────────────────

function toConsultantDTO(doc: PayloadConsultantDoc): ConsultantDTO {
  return {
    id: String(doc.id),
    fullName: doc.fullName,
    slug: doc.slug,
    title: doc.title ?? null,
    photoUrl: doc.photoUrl ?? null,
    shortBio: doc.shortBio ?? null,
    phone: doc.phone ?? null,
    email: doc.email ?? null,
    whatsappUrl: doc.whatsappUrl ?? null,
    linkedinUrl: doc.linkedinUrl ?? null,
    isPublished: doc.isPublished ?? false,
    sortOrder: doc.sortOrder ?? 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// Body parsing is delegated to content-consultants-parsers.ts (imported above).
// parseConsultantCreateBody and parseConsultantUpdateBody are now aliases
// for the exported pure functions there. No local parsing logic.

// ── Route handlers ─────────────────────────────────────────────────────────

export async function handleConsultantsListGet(
  request: Request,
  deps: ContentAdminRouteDependencies,
): Promise<Response> {
  const guard = await guardContentAdminRequest(deps);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20));

  const payload = await getPayload({ config: configPromise });

  const result = await payload.find({
    collection: "consultants",
    page,
    limit,
    sort: "sortOrder",
  });

  const items = result.docs.map((doc) => toConsultantDTO(doc as unknown as PayloadConsultantDoc));

  return jsonResponse(
    {
      success: true,
      data: {
        items,
        total: result.totalDocs,
        page: result.page ?? 1,
        limit,
        totalPages: result.totalPages ?? 0,
      } satisfies ConsultantListDTO,
    },
    200,
  );
}

export async function handleConsultantsCreatePost(
  request: Request,
  deps: ContentAdminRouteDependencies,
): Promise<Response> {
  const envelope = validateContentAdminJsonEnvelope(request);
  if (!envelope.ok) return jsonError(envelope.error, envelope.status);

  const guard = await guardContentAdminRequest(deps);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try { body = await request.json(); } catch {
    return jsonError("Invalid JSON request body", 400);
  }

  const parsed = parseConsultantCreateBody(body);
  if (!parsed.ok) return jsonError(parsed.error, parsed.status);

  const payload = await getPayload({ config: configPromise });

  try {
    const doc = await payload.create({
      collection: "consultants",
      data: parsed.value,
    });
    return jsonResponse(
      { success: true, data: toConsultantDTO(doc as unknown as PayloadConsultantDoc) },
      201,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create consultant";
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return jsonError("A consultant with this slug already exists", 409);
    }
    return jsonError(msg, 500);
  }
}

export async function handleConsultantGet(
  _request: Request,
  deps: ContentAdminRouteDependencies,
  id: string,
): Promise<Response> {
  const guard = await guardContentAdminRequest(deps);
  if (!guard.ok) return guard.response;

  const payload = await getPayload({ config: configPromise });

  try {
    const doc = await payload.findByID({ collection: "consultants", id });
    return jsonResponse(
      { success: true, data: toConsultantDTO(doc as unknown as PayloadConsultantDoc) },
      200,
    );
  } catch {
    return jsonError("Consultant not found", 404);
  }
}

export async function handleConsultantUpdate(
  request: Request,
  deps: ContentAdminRouteDependencies,
  id: string,
): Promise<Response> {
  const envelope = validateContentAdminJsonEnvelope(request);
  if (!envelope.ok) return jsonError(envelope.error, envelope.status);

  const guard = await guardContentAdminRequest(deps);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try { body = await request.json(); } catch {
    return jsonError("Invalid JSON request body", 400);
  }

  const parsed = parseConsultantUpdateBody(body);
  if (!parsed.ok) return jsonError(parsed.error, parsed.status);

  const payload = await getPayload({ config: configPromise });

  try {
    const doc = await payload.update({
      collection: "consultants",
      id,
      data: parsed.value,
    });
    return jsonResponse(
      { success: true, data: toConsultantDTO(doc as unknown as PayloadConsultantDoc) },
      200,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update consultant";
    if (msg.includes("not found")) return jsonError("Consultant not found", 404);
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return jsonError("A consultant with this slug already exists", 409);
    }
    return jsonError(msg, 500);
  }
}

export async function handleConsultantDelete(
  _request: Request,
  deps: ContentAdminRouteDependencies,
  id: string,
): Promise<Response> {
  const originCheck = validateContentAdminOrigin(_request);
  if (!originCheck.ok) return jsonError(originCheck.error, originCheck.status);

  const guard = await guardContentAdminRequest(deps);
  if (!guard.ok) return guard.response;

  const payload = await getPayload({ config: configPromise });

  try {
    await payload.delete({ collection: "consultants", id });
    return jsonResponse({ success: true }, 200);
  } catch {
    return jsonError("Consultant not found", 404);
  }
}
