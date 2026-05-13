export type CategoryOptionsFindArgs = {
  collection: "blog_categories";
  limit: number;
  sort: string;
  overrideAccess: true;
};

export function buildCategoryOptionsFindArgs(): CategoryOptionsFindArgs {
  return {
    collection: "blog_categories",
    limit: 500,
    sort: "sortOrder",
    overrideAccess: true,
  };
}

export const buildCategoryOptionsFindArgsForTest = buildCategoryOptionsFindArgs;
