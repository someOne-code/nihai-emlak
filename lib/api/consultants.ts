import { getPayload } from "payload";

import configPromise from "../../payload.config.ts";
import type { PublicConsultant } from "@/types/consultant";

type PayloadConsultantDoc = {
  id: number | string;
  fullName?: unknown;
  slug?: unknown;
  title?: unknown;
  photoUrl?: unknown;
  shortBio?: unknown;
  phone?: unknown;
  email?: unknown;
  whatsappUrl?: unknown;
  linkedinUrl?: unknown;
  isPublished?: unknown;
  sortOrder?: unknown;
};

const PUBLIC_CONSULTANT_SELECT = {
  id: true,
  fullName: true,
  slug: true,
  title: true,
  photoUrl: true,
  shortBio: true,
  phone: true,
  email: true,
  whatsappUrl: true,
  linkedinUrl: true,
  isPublished: true,
  sortOrder: true,
} as const;

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function consultantPhotoOrNull(value: unknown, supabasePublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL): string | null {
  const image = stringOrNull(value);
  if (!image) return null;
  if (image.startsWith("/")) return image;

  try {
    const imageUrl = new URL(image);
    const supabaseUrl = supabasePublicUrl ? new URL(supabasePublicUrl) : null;

    if (
      supabaseUrl
      && imageUrl.hostname === supabaseUrl.hostname
      && imageUrl.pathname.startsWith("/storage/v1/object/public/")
    ) {
      return image;
    }
  } catch {
    return null;
  }

  return null;
}

function mapPayloadConsultantToPublic(
  doc: PayloadConsultantDoc,
  supabasePublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
): PublicConsultant | null {
  const fullName = stringOrNull(doc.fullName);
  const slug = stringOrNull(doc.slug);
  if (!fullName || !slug) return null;

  return {
    id: String(doc.id),
    fullName,
    slug,
    title: stringOrNull(doc.title),
    photoUrl: consultantPhotoOrNull(doc.photoUrl, supabasePublicUrl),
    shortBio: stringOrNull(doc.shortBio),
    phone: stringOrNull(doc.phone),
    email: stringOrNull(doc.email),
    whatsappUrl: stringOrNull(doc.whatsappUrl),
    linkedinUrl: stringOrNull(doc.linkedinUrl),
  };
}

function compareConsultantDocs(left: PayloadConsultantDoc, right: PayloadConsultantDoc): number {
  const orderDiff = numberOrZero(left.sortOrder) - numberOrZero(right.sortOrder);
  if (orderDiff !== 0) return orderDiff;

  return (stringOrNull(left.fullName) ?? "").localeCompare(stringOrNull(right.fullName) ?? "", "tr", {
    sensitivity: "base",
  });
}

function mapPublishedPayloadConsultants(
  docs: PayloadConsultantDoc[],
  supabasePublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
): PublicConsultant[] {
  return docs
    .filter((doc) => doc.isPublished === true)
    .toSorted(compareConsultantDocs)
    .map((doc) => mapPayloadConsultantToPublic(doc, supabasePublicUrl))
    .filter((consultant): consultant is PublicConsultant => consultant !== null);
}

export function mapPublishedPayloadConsultantsForTest(
  docs: PayloadConsultantDoc[],
  options: { supabasePublicUrl?: string | null } = {},
): PublicConsultant[] {
  return mapPublishedPayloadConsultants(docs, options.supabasePublicUrl ?? undefined);
}

export async function listPublishedConsultants(): Promise<PublicConsultant[]> {
  try {
    const payload = await getPayload({ config: configPromise });
    const result = await payload.find({
      collection: "consultants",
      where: {
        isPublished: { equals: true },
      },
      sort: "sortOrder",
      limit: 100,
      depth: 0,
      select: PUBLIC_CONSULTANT_SELECT,
      overrideAccess: false,
    });

    return mapPublishedPayloadConsultants(result.docs as unknown as PayloadConsultantDoc[]);
  } catch {
    return [];
  }
}
