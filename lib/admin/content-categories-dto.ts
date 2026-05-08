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

export type CategoryDeleteWarningDTO = {
  hasLinkedPosts: boolean;
  linkedPostCount: number;
  message: string | null;
};

export type CategoryDetailDTO = CategoryDTO & {
  linkedPosts: CategoryLinkedPostDTO[];
  linkedPostCount: number;
  deleteWarning: CategoryDeleteWarningDTO;
};

export type PayloadCategoryDoc = {
  id: number | string;
  title: string;
  slug: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
};

export type PayloadCategoryLinkedPostDoc = {
  id: number | string;
  title?: string | null;
  status?: string | null;
  updatedAt?: string | null;
};

export function toCategoryDTO(doc: PayloadCategoryDoc): CategoryDTO {
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

export function toCategoryDetailDTO(
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

export const toCategoryDetailDTOForTest = toCategoryDetailDTO;
