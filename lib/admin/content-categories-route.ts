// Phase 9A Task 5: Categories content admin route handler.
//
// Uses Payload Local API behind the Next.js route boundary.
// Includes an /options endpoint for posts form select dropdowns.

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
  parseCategoryCreateBodyForTest as parseCategoryCreateBody,
  parseCategoryUpdateBodyForTest as parseCategoryUpdateBody,
  type CategoryCreateInput,
  type CategoryUpdateInput,
} from "./content-categories-parsers";
import { buildCategoryOptionsFindArgs } from "./content-categories-options";
import { buildCategoryLinkedPostsFindArgs } from "./content-category-linked-posts";

// ── DTO types ──────────────────────────────────────────────────────────────

export type CategoryDTO = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CategoryLinkedPostDTO = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
};

export type CategoryDetailDTO = CategoryDTO & {
  linkedPosts: CategoryLinkedPostDTO[];
  linkedPostCount: number;
  deleteWarning: {
    hasLinkedPosts: boolean;
    linkedPostCount: number;
    message: string | null;
  };
};

export type CategoryOptionDTO = {
  id: string;
  title: string;
};

export type CategoryListDTO = {
  items: CategoryDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// CategoryCreateInput and CategoryUpdateInput are re-exported from the parsers module.
export type { CategoryCreateInput, CategoryUpdateInput };

// ── Payload document shape ─────────────────────────────────────────────────

type PayloadCategoryDoc = {
  id: number | string;
  title: string;
  slug: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
};

type PayloadCategoryLinkedPostDoc = {
  id: number | string;
  title?: string | null;
  status?: string | null;
  updatedAt?: string | null;
};

// ── DTO mappers ────────────────────────────────────────────────────────────

function toCategoryDTO(doc: PayloadCategoryDoc): CategoryDTO {
  return {
    id: String(doc.id),
    title: doc.title,
    slug: doc.slug,
    description: doc.description ?? null,
    isActive: doc.isActive ?? true,
    sortOrder: doc.sortOrder ?? 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toCategoryDetailDTO(
  doc: PayloadCategoryDoc,
  linkedPosts: PayloadCategoryLinkedPostDoc[],
  totalLinkedPostCount = linkedPosts.length,
): CategoryDetailDTO {
  const linkedPostCount = Math.max(0, totalLinkedPostCount);
  return {
    ...toCategoryDTO(doc),
    linkedPosts: linkedPosts.map((post) => ({
      id: String(post.id),
      title: post.title ?? "Başlıksız",
      status: post.status ?? "draft",
      updatedAt: post.updatedAt ?? "",
    })),
    linkedPostCount,
    deleteWarning: {
      hasLinkedPosts: linkedPostCount > 0,
      linkedPostCount,
      message: linkedPostCount > 0
        ? `Bu kategoriye bağlı ${linkedPostCount} blog yazısı var.`
        : null,
    },
  };
}

// Body parsing is delegated to content-categories-parsers.ts (imported above).
// parseCategoryCreateBody and parseCategoryUpdateBody are now aliases
// for the exported pure functions there. No local parsing logic.

// ── Route handlers ─────────────────────────────────────────────────────────

export async function handleCategoriesListGet(
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
    collection: "blog_categories",
    page,
    limit,
    sort: "sortOrder",
  });

  const items = result.docs.map((doc) => toCategoryDTO(doc as unknown as PayloadCategoryDoc));

  return jsonResponse(
    {
      success: true,
      data: {
        items,
        total: result.totalDocs,
        page: result.page ?? 1,
        limit,
        totalPages: result.totalPages ?? 0,
      } satisfies CategoryListDTO,
    },
    200,
  );
}

export async function handleCategoriesOptionsGet(
  _request: Request,
  deps: ContentAdminRouteDependencies,
): Promise<Response> {
  const guard = await guardContentAdminRequest(deps);
  if (!guard.ok) return guard.response;

  const payload = await getPayload({ config: configPromise });

  const result = await payload.find(buildCategoryOptionsFindArgs());

  const options: CategoryOptionDTO[] = result.docs.map((doc) => ({
    id: String(doc.id),
    title: (doc as PayloadCategoryDoc).title,
  }));

  return jsonResponse({ success: true, data: options }, 200);
}

export async function handleCategoriesCreatePost(
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

  const parsed = parseCategoryCreateBody(body);
  if (!parsed.ok) return jsonError(parsed.error, parsed.status);

  const payload = await getPayload({ config: configPromise });

  try {
    const doc = await payload.create({
      collection: "blog_categories",
      data: parsed.value,
    });
    return jsonResponse(
      { success: true, data: toCategoryDTO(doc as unknown as PayloadCategoryDoc) },
      201,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create category";
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return jsonError("A category with this slug already exists", 409);
    }
    return jsonError(msg, 500);
  }
}

export async function handleCategoryGet(
  _request: Request,
  deps: ContentAdminRouteDependencies,
  id: string,
): Promise<Response> {
  const guard = await guardContentAdminRequest(deps);
  if (!guard.ok) return guard.response;

  const payload = await getPayload({ config: configPromise });

  try {
    const doc = await payload.findByID({ collection: "blog_categories", id });
    const linkedPosts = await payload.find(buildCategoryLinkedPostsFindArgs(id));
    return jsonResponse(
      {
        success: true,
        data: toCategoryDetailDTO(
          doc as unknown as PayloadCategoryDoc,
          linkedPosts.docs as unknown as PayloadCategoryLinkedPostDoc[],
          linkedPosts.totalDocs,
        ),
      },
      200,
    );
  } catch {
    return jsonError("Category not found", 404);
  }
}

export async function handleCategoryUpdate(
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

  const parsed = parseCategoryUpdateBody(body);
  if (!parsed.ok) return jsonError(parsed.error, parsed.status);

  const payload = await getPayload({ config: configPromise });

  try {
    const doc = await payload.update({
      collection: "blog_categories",
      id,
      data: parsed.value,
    });
    return jsonResponse(
      { success: true, data: toCategoryDTO(doc as unknown as PayloadCategoryDoc) },
      200,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update category";
    if (msg.includes("not found")) return jsonError("Category not found", 404);
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return jsonError("A category with this slug already exists", 409);
    }
    return jsonError(msg, 500);
  }
}

export async function handleCategoryDelete(
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
    await payload.delete({ collection: "blog_categories", id });
    return jsonResponse({ success: true }, 200);
  } catch {
    return jsonError("Category not found", 404);
  }
}
