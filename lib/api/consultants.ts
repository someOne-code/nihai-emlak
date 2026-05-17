import net from "node:net";

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

const DEV_FALLBACK_CONSULTANTS: PublicConsultant[] = [
  {
    id: "local-elif-yilmaz",
    fullName: "Elif Yilmaz",
    slug: "elif-yilmaz",
    title: "Satis ve Kiralama Danismani",
    photoUrl: "/property-nextjs-pro/images/hero/hero-profile-2.jpg",
    shortBio: "Istanbul'un merkezi bolgelerinde satilik ve kiralik sureclerde musteri odakli destek sunar.",
    phone: "+902120000001",
    email: "elif.yilmaz@example.test",
    whatsappUrl: "https://wa.me/902120000001",
    linkedinUrl: "https://www.linkedin.com/",
  },
  {
    id: "local-murat-arslan",
    fullName: "Murat Arslan",
    slug: "murat-arslan",
    title: "Yatirim Danismani",
    photoUrl: "/property-nextjs-pro/images/hero/hero-profile-1.jpg",
    shortBio: "Konut yatirimi, portfoy degerleme ve bolge karsilastirmalarinda seffaf danismanlik saglar.",
    phone: null,
    email: "murat.arslan@example.test",
    whatsappUrl: null,
    linkedinUrl: "https://www.linkedin.com/",
  },
];

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
  if (shouldUseDevFallbackConsultants() && !(await canReachLocalPayloadDatabase())) {
    return DEV_FALLBACK_CONSULTANTS;
  }

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
    if (shouldUseDevFallbackConsultants()) {
      return DEV_FALLBACK_CONSULTANTS;
    }

    return [];
  }
}

function shouldUseDevFallbackConsultants(): boolean {
  return process.env.NODE_ENV !== "production";
}

async function canReachLocalPayloadDatabase(): Promise<boolean> {
  const databaseUri = process.env.DATABASE_URI;
  if (!databaseUri) return true;

  let parsed: URL;
  try {
    parsed = new URL(databaseUri);
  } catch {
    return true;
  }

  if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
    return true;
  }

  const port = Number(parsed.port || 5432);
  if (!Number.isSafeInteger(port) || port < 1) {
    return true;
  }

  return new Promise((resolve) => {
    const socket = net.createConnection({ host: parsed.hostname, port, timeout: 250 });
    const finish = (result: boolean) => {
      socket.destroy();
      resolve(result);
    };

    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });
}
