export const CONSULTANT_LIST_SELECT = {
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
  createdAt: true,
  updatedAt: true,
} as const;

export function buildConsultantsListFindArgs(page: number, limit: number) {
  return {
    collection: "consultants",
    page,
    limit,
    sort: "sortOrder",
    depth: 0,
    select: CONSULTANT_LIST_SELECT,
  } as const;
}
