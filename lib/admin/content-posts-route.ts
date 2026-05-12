// Phase 9A Task 4: Posts content admin route handler.
//
// Uses Payload Local API behind the Next.js route boundary.
// Auth/origin/content-type/body parsing is done in our route layer;
// the UI never talks directly to Payload REST/GraphQL.
//
// DTO is simplified; the UI does not consume raw Payload shapes.

import { getPayload } from "payload";
import configPromise from "../../payload.config.ts";

import {
  guardContentAdminRequest,
  jsonError,
  jsonResponse,
  readContentAdminJsonPayload,
  validateContentAdminJsonEnvelope,
  validateContentAdminOrigin,
} from "./content-shared.ts";
import type { ContentAdminRouteDependencies } from "./content-shared.ts";
import {
  parsePostCreateBodyForTest as parsePostCreateBody,
  parsePostUpdateBodyForTest as parsePostUpdateBody,
  type PostCreateInput,
  type PostUpdateInput,
} from "./content-posts-parsers.ts";
import {
  buildPayloadPostCreateData,
  buildPayloadPostUpdateData,
} from "./content-posts-payload.ts";

// ── DTO types ──────────────────────────────────────────────────────────────

export type PostDTO = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  category: { id: string; title: string } | null;
  status: "draft" | "published";
  publishedAt: string | null;
  coverImageUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PostListDTO = {
  items: PostDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// PostCreateInput and PostUpdateInput are re-exported from the parsers module.
export type { PostCreateInput, PostUpdateInput };

// ── Payload document shape (internal) ──────────────────────────────────────

type PayloadPostDoc = {
  id: number | string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  category?: { id: number | string; title: string } | number | string | null;
  status?: "draft" | "published";
  publishedAt?: string | null;
  coverImageUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  createdAt: string;
  updatedAt: string;
};

// ── DTO mappers ────────────────────────────────────────────────────────────

function toPostDTO(doc: PayloadPostDoc): PostDTO {
  const category =
    doc.category && typeof doc.category === "object" && "id" in doc.category
      ? { id: String(doc.category.id), title: (doc.category as { title: string }).title }
      : null;

  return {
    id: String(doc.id),
    title: doc.title,
    slug: doc.slug,
    excerpt: doc.excerpt ?? null,
    content: doc.content,
    category,
    status: doc.status ?? "draft",
    publishedAt: doc.publishedAt ?? null,
    coverImageUrl: doc.coverImageUrl ?? null,
    seoTitle: doc.seoTitle ?? null,
    seoDescription: doc.seoDescription ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// Body parsing is delegated to content-posts-parsers.ts (imported above).
// parsePostCreateBody and parsePostUpdateBody are now aliases
// for the exported pure functions there. No local parsing logic.

// ── Query parsing ──────────────────────────────────────────────────────────

type PostsQuery = {
  search?: string;
  status?: "draft" | "published";
  category?: string;
  page?: number;
  limit?: number;
};

function parsePostsQuery(url: URL): PostsQuery {
  const search = url.searchParams.get("search") ?? undefined;
  const statusRaw = url.searchParams.get("status");
  const status =
    statusRaw === "draft" || statusRaw === "published" ? statusRaw : undefined;
  const category = url.searchParams.get("category") ?? undefined;
  const pageRaw = url.searchParams.get("page");
  const limitRaw = url.searchParams.get("limit");

  const page = pageRaw ? Math.max(1, parseInt(pageRaw, 10) || 1) : 1;
  const limit = limitRaw ? Math.min(100, Math.max(1, parseInt(limitRaw, 10) || 20)) : 20;

  return { search, status, category, page, limit };
}


// ── Route handlers ─────────────────────────────────────────────────────────

export async function handlePostsListGet(
  request: Request,
  _deps: ContentAdminRouteDependencies,
): Promise<Response> {
  const guard = await guardContentAdminRequest(_deps);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const query = parsePostsQuery(url);

  const payload = await getPayload({ config: configPromise });

  const where: Record<string, unknown> = {};
  if (query.status) {
    where.status = { equals: query.status };
  }
  if (query.category) {
    where.category = { equals: query.category };
  }
  if (query.search) {
    where.or = [
      { title: { like: query.search } },
      { slug: { like: query.search } },
    ];
  }

  const result = await payload.find({
    collection: "blog_posts",
    where: Object.keys(where).length > 0 ? (where as unknown as Parameters<typeof payload.find>[0]["where"]) : undefined,
    page: query.page,
    limit: query.limit,
    sort: "-createdAt",
    depth: 1,
  });

  const items = result.docs.map((doc) => toPostDTO(doc as unknown as PayloadPostDoc));

  return jsonResponse(
    {
      success: true,
      data: {
        items,
        total: result.totalDocs,
        page: result.page ?? 1,
        limit: query.limit ?? 20,
        totalPages: result.totalPages ?? 0,
      } satisfies PostListDTO,
    },
    200,
  );
}

export async function handlePostsCreatePost(
  request: Request,
  deps: ContentAdminRouteDependencies,
): Promise<Response> {
  const envelope = validateContentAdminJsonEnvelope(request);
  if (!envelope.ok) return jsonError(envelope.error, envelope.status);

  const bodyResult = await readContentAdminJsonPayload(request);
  if (!bodyResult.ok) return jsonError(bodyResult.error, bodyResult.status);

  const guard = await guardContentAdminRequest(deps);
  if (!guard.ok) return guard.response;

  const parsed = parsePostCreateBody(bodyResult.value);
  if (!parsed.ok) {
    return jsonError(parsed.error, parsed.status);
  }

  const payload = await getPayload({ config: configPromise });

  try {
    const doc = await payload.create({
      collection: "blog_posts",
      data: buildPayloadPostCreateData(parsed.value),
    });

    return jsonResponse(
      { success: true, data: toPostDTO(doc as unknown as PayloadPostDoc) },
      201,
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to create post";
    if (message.includes("duplicate") || message.includes("unique")) {
      return jsonError("A post with this slug already exists", 409);
    }
    return jsonError(message, 500);
  }
}

export async function handlePostGet(
  _request: Request,
  deps: ContentAdminRouteDependencies,
  id: string,
): Promise<Response> {
  const guard = await guardContentAdminRequest(deps);
  if (!guard.ok) return guard.response;

  const payload = await getPayload({ config: configPromise });

  try {
    const doc = await payload.findByID({
      collection: "blog_posts",
      id,
      depth: 1,
    });

    return jsonResponse(
      { success: true, data: toPostDTO(doc as unknown as PayloadPostDoc) },
      200,
    );
  } catch {
    return jsonError("Post not found", 404);
  }
}

export async function handlePostUpdate(
  request: Request,
  deps: ContentAdminRouteDependencies,
  id: string,
): Promise<Response> {
  const envelope = validateContentAdminJsonEnvelope(request);
  if (!envelope.ok) return jsonError(envelope.error, envelope.status);

  const bodyResult = await readContentAdminJsonPayload(request);
  if (!bodyResult.ok) return jsonError(bodyResult.error, bodyResult.status);

  const guard = await guardContentAdminRequest(deps);
  if (!guard.ok) return guard.response;

  const parsed = parsePostUpdateBody(bodyResult.value);
  if (!parsed.ok) {
    return jsonError(parsed.error, parsed.status);
  }

  const payload = await getPayload({ config: configPromise });

  try {
    const doc = await payload.update({
      collection: "blog_posts",
      id,
      data: buildPayloadPostUpdateData(parsed.value),
    });

    return jsonResponse(
      { success: true, data: toPostDTO(doc as unknown as PayloadPostDoc) },
      200,
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to update post";
    if (message.includes("not found") || message.includes("Not found")) {
      return jsonError("Post not found", 404);
    }
    if (message.includes("duplicate") || message.includes("unique")) {
      return jsonError("A post with this slug already exists", 409);
    }
    return jsonError(message, 500);
  }
}

export async function handlePostDelete(
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
    await payload.delete({
      collection: "blog_posts",
      id,
    });

    return jsonResponse({ success: true }, 200);
  } catch {
    return jsonError("Post not found", 404);
  }
}
