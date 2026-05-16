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
} as const;

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function consultantPhotoOrNull(value: unknown): string | null {
  const image = stringOrNull(value);
  if (!image) return null;
  if (image.startsWith("/")) return image;

  try {
    const imageUrl = new URL(image);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
      : null;

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

function mapPayloadConsultantToPublic(doc: PayloadConsultantDoc): PublicConsultant | null {
  const fullName = stringOrNull(doc.fullName);
  const slug = stringOrNull(doc.slug);
  if (!fullName || !slug) return null;

  return {
    id: String(doc.id),
    fullName,
    slug,
    title: stringOrNull(doc.title),
    photoUrl: consultantPhotoOrNull(doc.photoUrl),
    shortBio: stringOrNull(doc.shortBio),
    phone: stringOrNull(doc.phone),
    email: stringOrNull(doc.email),
    whatsappUrl: stringOrNull(doc.whatsappUrl),
    linkedinUrl: stringOrNull(doc.linkedinUrl),
  };
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

    return result.docs
      .map((doc) => mapPayloadConsultantToPublic(doc as unknown as PayloadConsultantDoc))
      .filter((consultant): consultant is PublicConsultant => consultant !== null);
  } catch {
    return [];
  }
}
