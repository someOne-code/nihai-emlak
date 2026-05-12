import type { CollectionConfig } from "payload";

import { validateImageUrl } from "../../lib/validation/image-url.ts";

import {
  canCreateContent,
  canDeleteContent,
  canUpdateContent,
  publishedConsultantReadFilter,
} from "../access/content.ts";

export const Consultants: CollectionConfig = {
  slug: "consultants",
  admin: {
    useAsTitle: "fullName",
  },
  access: {
    create: canCreateContent,
    read: publishedConsultantReadFilter,
    update: canUpdateContent,
    delete: canDeleteContent,
  },
  fields: [
    {
      name: "fullName",
      type: "text",
      required: true,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
    },
    {
      name: "title",
      type: "text",
    },
    {
      name: "photoUrl",
      type: "text",
      validate: validateImageUrl,
    },
    {
      name: "shortBio",
      type: "textarea",
    },
    {
      name: "phone",
      type: "text",
    },
    {
      name: "email",
      type: "email",
    },
    {
      name: "whatsappUrl",
      type: "text",
    },
    {
      name: "linkedinUrl",
      type: "text",
    },
    {
      name: "isPublished",
      type: "checkbox",
      defaultValue: false,
    },
    {
      name: "sortOrder",
      type: "number",
      defaultValue: 0,
    },
  ],
};
