import type { CollectionConfig } from "payload";

import {
  activeCategoryReadFilter,
  canCreateContent,
  canDeleteContent,
  canUpdateContent,
} from "../access/content.ts";

export const BlogCategories: CollectionConfig = {
  slug: "blog_categories",
  admin: {
    useAsTitle: "title",
  },
  access: {
    create: canCreateContent,
    read: activeCategoryReadFilter,
    update: canUpdateContent,
    delete: canDeleteContent,
  },
  fields: [
    {
      name: "title",
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
      name: "description",
      type: "textarea",
    },
    {
      name: "isActive",
      type: "checkbox",
      defaultValue: true,
    },
    {
      name: "sortOrder",
      type: "number",
      defaultValue: 0,
    },
  ],
};
