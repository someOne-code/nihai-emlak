export const CATEGORY_LIST_SELECT = {
  id: true,
  title: true,
  slug: true,
  description: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function buildCategoriesListFindArgs(page: number, limit: number) {
  return {
    collection: "blog_categories",
    page,
    limit,
    sort: "sortOrder",
    depth: 0,
    select: CATEGORY_LIST_SELECT,
  } as const;
}

export const buildCategoriesListFindArgsForTest = buildCategoriesListFindArgs;
