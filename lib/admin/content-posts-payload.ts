import type { PostCreateInput, PostUpdateInput } from "./content-posts-parsers";

type PayloadRelationshipId = string | number | null | undefined;
type PayloadPostCreateData = Omit<PostCreateInput, "category"> & {
  category?: PayloadRelationshipId;
};
type PayloadPostUpdateData = Omit<PostUpdateInput, "category"> & {
  category?: PayloadRelationshipId;
};

function normalizePayloadRelationshipId(value: PayloadRelationshipId): PayloadRelationshipId {
  if (typeof value !== "string") return value;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

export function buildPayloadPostCreateData(input: PostCreateInput): PayloadPostCreateData {
  return {
    title: input.title,
    slug: input.slug,
    excerpt: input.excerpt,
    content: input.content,
    category: normalizePayloadRelationshipId(input.category),
    status: input.status ?? "draft",
    publishedAt: input.publishedAt,
    coverImageUrl: input.coverImageUrl,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
  };
}

export function buildPayloadPostUpdateData(input: PostUpdateInput): PayloadPostUpdateData {
  return {
    ...input,
    category: normalizePayloadRelationshipId(input.category),
  };
}

export const buildPayloadPostCreateDataForTest = buildPayloadPostCreateData;
export const buildPayloadPostUpdateDataForTest = buildPayloadPostUpdateData;
