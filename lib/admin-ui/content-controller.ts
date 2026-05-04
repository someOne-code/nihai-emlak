// Phase 9A Task 7: Content admin controller layer.
//
// Orchestrates client fetches and view-model transformation for the
// custom content admin UI pages (posts, categories, consultants).
//
// Mirrors lib/admin-ui/listings-controller.ts and operations-controller.ts
// patterns exactly:
//   - Dependency injection via typed interfaces (default deps use real client)
//   - Returns typed view-model, never raw API response
//   - Typed error class for UI error boundary use
//
// Does NOT call Payload or any server-side API directly. All data flows
// through the Next.js route proxy via content-client.ts functions.

import {
  fetchAdminPostsListFiltered,
  fetchAdminPost,
  fetchAdminCategoriesList,
  fetchAdminCategory,
  fetchAdminConsultantsList,
  fetchAdminConsultant,
  type PostsListFilters,
} from "./content-client.ts";

import {
  buildPostsListViewModel,
  buildPostDetail,
  buildCategoriesListViewModel,
  buildCategoryDetail,
  buildConsultantsListViewModel,
  buildConsultantDetail,
  type PostsListViewModel,
  type PostDetail,
  type CategoriesListViewModel,
  type CategoryDetail,
  type ConsultantsListViewModel,
  type ConsultantDetail,
} from "./content-view-model.ts";

// ── Error class ──────────────────────────────────────────────────────────────

export class ContentControllerError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ContentControllerError";
    this.status = status;
  }
}

// ── Posts controller ─────────────────────────────────────────────────────────

export type PostsLoaderDependencies = {
  fetchAdminPostsListFiltered: (filters: PostsListFilters) => Promise<unknown>;
};

const DEFAULT_POSTS_DEPS: PostsLoaderDependencies = {
  fetchAdminPostsListFiltered,
};

export async function loadPostsModel(
  dependencies: PostsLoaderDependencies = DEFAULT_POSTS_DEPS,
  filters: PostsListFilters,
): Promise<PostsListViewModel> {
  const data = await dependencies.fetchAdminPostsListFiltered(filters);
  return buildPostsListViewModel(data);
}

// ── Categories controller ────────────────────────────────────────────────────

export type CategoriesLoaderDependencies = {
  fetchAdminCategoriesList: () => Promise<unknown>;
};

const DEFAULT_CATEGORIES_DEPS: CategoriesLoaderDependencies = {
  fetchAdminCategoriesList,
};

export async function loadCategoriesModel(
  dependencies: CategoriesLoaderDependencies = DEFAULT_CATEGORIES_DEPS,
): Promise<CategoriesListViewModel> {
  const data = await dependencies.fetchAdminCategoriesList();
  return buildCategoriesListViewModel(data);
}

// ── Consultants controller ───────────────────────────────────────────────────

export type ConsultantsLoaderDependencies = {
  fetchAdminConsultantsList: () => Promise<unknown>;
};

const DEFAULT_CONSULTANTS_DEPS: ConsultantsLoaderDependencies = {
  fetchAdminConsultantsList,
};

export async function loadConsultantsModel(
  dependencies: ConsultantsLoaderDependencies = DEFAULT_CONSULTANTS_DEPS,
): Promise<ConsultantsListViewModel> {
  const data = await dependencies.fetchAdminConsultantsList();
  return buildConsultantsListViewModel(data);
}

// ── Detail loader (unified) ──────────────────────────────────────────────────
//
// Analogous to selectAdminListing in listings-controller.ts.
// The collection discriminant drives which client function is called and which
// view-model mapper is applied, returning a tagged union so callers can
// narrow the type safely.

export type ContentDetailResult =
  | { type: "post"; detail: PostDetail }
  | { type: "category"; detail: CategoryDetail }
  | { type: "consultant"; detail: ConsultantDetail };

export type ContentDetailLoaderDependencies = {
  fetchAdminPost: (id: string) => Promise<unknown>;
  fetchAdminCategory: (id: string) => Promise<unknown>;
  fetchAdminConsultant: (id: string) => Promise<unknown>;
};

const DEFAULT_DETAIL_DEPS: ContentDetailLoaderDependencies = {
  fetchAdminPost,
  fetchAdminCategory,
  fetchAdminConsultant,
};

export async function loadContentDetailModel(
  collection: "posts" | "categories" | "consultants",
  id: string,
  dependencies: ContentDetailLoaderDependencies = DEFAULT_DETAIL_DEPS,
): Promise<ContentDetailResult | null> {
  if (collection === "posts") {
    const data = await dependencies.fetchAdminPost(id);
    const detail = buildPostDetail(data);
    return detail ? { type: "post", detail } : null;
  }

  if (collection === "categories") {
    const data = await dependencies.fetchAdminCategory(id);
    const detail = buildCategoryDetail(data);
    return detail ? { type: "category", detail } : null;
  }

  if (collection === "consultants") {
    const data = await dependencies.fetchAdminConsultant(id);
    const detail = buildConsultantDetail(data);
    return detail ? { type: "consultant", detail } : null;
  }

  return null;
}
