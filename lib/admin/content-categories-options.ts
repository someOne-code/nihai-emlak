export type CategoryOptionsFindArgs = {
  collection: "blog_categories";
  limit: number;
  sort: string;
};

export function buildCategoryOptionsFindArgs(): CategoryOptionsFindArgs {
  return {
    collection: "blog_categories",
    limit: 500,
    sort: "sortOrder",
  };
}

export const buildCategoryOptionsFindArgsForTest = buildCategoryOptionsFindArgs;
