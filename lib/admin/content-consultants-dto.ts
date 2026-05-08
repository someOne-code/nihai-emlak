export type ConsultantDTO = {
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

export type PayloadConsultantDoc = {
  id: number | string;
  fullName: string;
  slug: string;
  title?: string | null;
  photoUrl?: string | null;
  shortBio?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsappUrl?: string | null;
  linkedinUrl?: string | null;
  isPublished?: boolean;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
};

export function toConsultantDTO(doc: PayloadConsultantDoc): ConsultantDTO {
  return {
    id: String(doc.id),
    fullName: doc.fullName,
    slug: doc.slug,
    title: doc.title ?? null,
    photoUrl: doc.photoUrl ?? null,
    shortBio: doc.shortBio ?? null,
    phone: doc.phone ?? null,
    email: doc.email ?? null,
    whatsappUrl: doc.whatsappUrl ?? null,
    linkedinUrl: doc.linkedinUrl ?? null,
    isPublished: doc.isPublished ?? false,
    sortOrder: doc.sortOrder ?? 0,
    previewLink: `/consultants/${doc.slug}`,
    relatedCounts: {
      contactChannels: countPresent([doc.phone, doc.email, doc.whatsappUrl]),
      externalLinks: countPresent([doc.linkedinUrl]),
    },
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function countPresent(values: unknown[]): number {
  return values.filter((value) => typeof value === "string" && value.trim().length > 0).length;
}

export const toConsultantDTOForTest = toConsultantDTO;
