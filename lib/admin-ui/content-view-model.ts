// Phase 9A Task 7: Content admin view-model layer.
//
// Translates raw API envelope data into UI-friendly shapes.
// No unknown fields leak through; Turkish display labels are
// defined here so tests and components share the same copy.
// Mirrors lib/admin-ui/listings-view-model.ts pattern.

// ── Posts view-model ───────────────────────────────────────────────────────

export type PostStatus = "draft" | "published" | "unknown";

export type PostRow = {
  id: string;
  title: string;
  slug: string;
  statusLabel: string;
  categoryLabel: string;
  publishedAt: string | null;
  updatedAt: string;
};

export type PostDetail = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  category: { id: string; title: string } | null;
  status: PostStatus;
  publishedAt: string | null;
  coverImageUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PostsListViewModel = {
  rows: PostRow[];
  total: number;
  page: number;
  totalPages: number;
  isEmpty: boolean;
};

const POST_STATUS_LABELS: Record<PostStatus, string> = {
  draft: "Taslak",
  published: "Yayında",
  unknown: "Bilinmiyor",
};

function normalizePostStatus(value: unknown): PostStatus {
  if (value === "draft" || value === "published") return value;
  return "unknown";
}

export function buildPostsListViewModel(data: unknown): PostsListViewModel {
  if (!isRecord(data)) {
    return { rows: [], total: 0, page: 1, totalPages: 0, isEmpty: true };
  }
  const items = Array.isArray(data.items) ? data.items.filter(isRecord) : [];
  const rows: PostRow[] = items.map((item) => ({
    id: asString(item.id) ?? "",
    title: asString(item.title) ?? "Başlıksız",
    slug: asString(item.slug) ?? "",
    statusLabel: POST_STATUS_LABELS[normalizePostStatus(item.status)],
    categoryLabel: isRecord(item.category) ? (asString(item.category.title) ?? "—") : "—",
    publishedAt: asString(item.publishedAt),
    updatedAt: asString(item.updatedAt) ?? "",
  }));
  return {
    rows,
    total: asNumber(data.total) ?? 0,
    page: asNumber(data.page) ?? 1,
    totalPages: asNumber(data.totalPages) ?? 0,
    isEmpty: rows.length === 0,
  };
}

export function buildPostDetail(data: unknown): PostDetail | null {
  if (!isRecord(data)) return null;
  const category =
    isRecord(data.category)
      ? { id: asString(data.category.id) ?? "", title: asString(data.category.title) ?? "" }
      : null;
  return {
    id: asString(data.id) ?? "",
    title: asString(data.title) ?? "",
    slug: asString(data.slug) ?? "",
    excerpt: asString(data.excerpt),
    content: asString(data.content) ?? "",
    category,
    status: normalizePostStatus(data.status),
    publishedAt: asString(data.publishedAt),
    coverImageUrl: asString(data.coverImageUrl),
    seoTitle: asString(data.seoTitle),
    seoDescription: asString(data.seoDescription),
    createdAt: asString(data.createdAt) ?? "",
    updatedAt: asString(data.updatedAt) ?? "",
  };
}

// ── Categories view-model ──────────────────────────────────────────────────

export type CategoryRow = {
  id: string;
  title: string;
  slug: string;
  isActiveLabel: string;
  sortOrder: number;
  updatedAt: string;
};

export type CategoryDetail = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  linkedPosts: CategoryLinkedPost[];
  linkedPostCount: number;
  deleteWarning: {
    hasLinkedPosts: boolean;
    linkedPostCount: number;
    message: string | null;
  };
  createdAt: string;
  updatedAt: string;
};

export type CategoryLinkedPost = {
  id: string;
  title: string;
  statusLabel: string;
  updatedAt: string;
};

export type CategoriesListViewModel = {
  rows: CategoryRow[];
  total: number;
  page: number;
  totalPages: number;
  isEmpty: boolean;
};

export function buildCategoriesListViewModel(data: unknown): CategoriesListViewModel {
  if (!isRecord(data)) {
    return { rows: [], total: 0, page: 1, totalPages: 0, isEmpty: true };
  }
  const items = Array.isArray(data.items) ? data.items.filter(isRecord) : [];
  const rows: CategoryRow[] = items.map((item) => ({
    id: asString(item.id) ?? "",
    title: asString(item.title) ?? "Başlıksız",
    slug: asString(item.slug) ?? "",
    isActiveLabel: item.isActive === true ? "Aktif" : "Pasif",
    sortOrder: asNumber(item.sortOrder) ?? 0,
    updatedAt: asString(item.updatedAt) ?? "",
  }));
  return {
    rows,
    total: asNumber(data.total) ?? 0,
    page: asNumber(data.page) ?? 1,
    totalPages: asNumber(data.totalPages) ?? 0,
    isEmpty: rows.length === 0,
  };
}

export function buildCategoryDetail(data: unknown): CategoryDetail | null {
  if (!isRecord(data)) return null;
  const linkedPosts = Array.isArray(data.linkedPosts)
    ? data.linkedPosts.filter(isRecord).map((post): CategoryLinkedPost => ({
        id: asString(post.id) ?? "",
        title: asString(post.title) ?? "Başlıksız",
        statusLabel: POST_STATUS_LABELS[normalizePostStatus(post.status)],
        updatedAt: asString(post.updatedAt) ?? "",
      }))
    : [];

  return {
    id: asString(data.id) ?? "",
    title: asString(data.title) ?? "",
    slug: asString(data.slug) ?? "",
    description: asString(data.description),
    isActive: data.isActive === true,
    sortOrder: asNumber(data.sortOrder) ?? 0,
    linkedPosts,
    linkedPostCount: asNumber(data.linkedPostCount) ?? linkedPosts.length,
    deleteWarning: buildCategoryDeleteWarning(data.deleteWarning, linkedPosts.length),
    createdAt: asString(data.createdAt) ?? "",
    updatedAt: asString(data.updatedAt) ?? "",
  };
}

function buildCategoryDeleteWarning(value: unknown, fallbackLinkedPostCount: number): CategoryDetail["deleteWarning"] {
  if (!isRecord(value)) {
    return {
      hasLinkedPosts: fallbackLinkedPostCount > 0,
      linkedPostCount: fallbackLinkedPostCount,
      message: fallbackLinkedPostCount > 0 ? `Bu kategoriye bağlı ${fallbackLinkedPostCount} blog yazısı var.` : null,
    };
  }
  const linkedPostCount = asNumber(value.linkedPostCount) ?? fallbackLinkedPostCount;
  return {
    hasLinkedPosts: value.hasLinkedPosts === true,
    linkedPostCount,
    message: asString(value.message),
  };
}

// ── Consultants view-model ─────────────────────────────────────────────────

export type ConsultantRow = {
  id: string;
  fullName: string;
  slug: string;
  titleLabel: string;
  isPublishedLabel: string;
  sortOrder: number;
  updatedAt: string;
};

export type ConsultantDetail = {
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
  previewLink: string;
  relatedCounts: {
    contactChannels: number;
    externalLinks: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type ConsultantsListViewModel = {
  rows: ConsultantRow[];
  total: number;
  page: number;
  totalPages: number;
  isEmpty: boolean;
};

export function buildConsultantsListViewModel(data: unknown): ConsultantsListViewModel {
  if (!isRecord(data)) {
    return { rows: [], total: 0, page: 1, totalPages: 0, isEmpty: true };
  }
  const items = Array.isArray(data.items) ? data.items.filter(isRecord) : [];
  const rows: ConsultantRow[] = items.map((item) => ({
    id: asString(item.id) ?? "",
    fullName: asString(item.fullName) ?? "İsimsiz Danışman",
    slug: asString(item.slug) ?? "",
    titleLabel: asString(item.title) ?? "—",
    isPublishedLabel: item.isPublished === true ? "Yayında" : "Taslak",
    sortOrder: asNumber(item.sortOrder) ?? 0,
    updatedAt: asString(item.updatedAt) ?? "",
  }));
  return {
    rows,
    total: asNumber(data.total) ?? 0,
    page: asNumber(data.page) ?? 1,
    totalPages: asNumber(data.totalPages) ?? 0,
    isEmpty: rows.length === 0,
  };
}

export function buildConsultantDetail(data: unknown): ConsultantDetail | null {
  if (!isRecord(data)) return null;
  return {
    id: asString(data.id) ?? "",
    fullName: asString(data.fullName) ?? "",
    slug: asString(data.slug) ?? "",
    title: asString(data.title),
    photoUrl: asString(data.photoUrl),
    shortBio: asString(data.shortBio),
    phone: asString(data.phone),
    email: asString(data.email),
    whatsappUrl: asString(data.whatsappUrl),
    linkedinUrl: asString(data.linkedinUrl),
    isPublished: data.isPublished === true,
    sortOrder: asNumber(data.sortOrder) ?? 0,
    previewLink: asString(data.previewLink) ?? "",
    relatedCounts: buildConsultantRelatedCounts(data.relatedCounts),
    createdAt: asString(data.createdAt) ?? "",
    updatedAt: asString(data.updatedAt) ?? "",
  };
}

function buildConsultantRelatedCounts(value: unknown): ConsultantDetail["relatedCounts"] {
  if (!isRecord(value)) {
    return { contactChannels: 0, externalLinks: 0 };
  }
  return {
    contactChannels: asNumber(value.contactChannels) ?? 0,
    externalLinks: asNumber(value.externalLinks) ?? 0,
  };
}

// ── Shared helpers ─────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  return value.trim();
}

function asNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}
