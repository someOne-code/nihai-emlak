type PayloadRelationshipId = string | number;

export function normalizePayloadRelationshipId(
  id: string,
): PayloadRelationshipId {
  const trimmed = id.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  return trimmed;
}

export function buildCategoryLinkedPostsFindArgs(categoryId: string) {
  return {
    collection: "blog_posts" as const,
    where: {
      category: { equals: normalizePayloadRelationshipId(categoryId) },
    },
    limit: 50,
    sort: "-updatedAt",
    depth: 0,
    overrideAccess: true,
  };
}

export const buildCategoryLinkedPostsFindArgsForTest =
  buildCategoryLinkedPostsFindArgs;
