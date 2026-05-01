import type { CollectionConfig } from "payload";

import {
  canCreateContent,
  canDeleteContent,
  canUpdateContent,
  publishedBlogReadFilter,
} from "../access/content.ts";

export const BlogPosts: CollectionConfig = {
  slug: "blog_posts",
  admin: {
    useAsTitle: "title",
  },
  access: {
    create: canCreateContent,
    read: publishedBlogReadFilter,
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
      name: "excerpt",
      type: "textarea",
    },
    {
      name: "content",
      type: "textarea",
      required: true,
    },
    {
      name: "category",
      type: "relationship",
      relationTo: "blog_categories",
    },
    {
      name: "status",
      type: "select",
      defaultValue: "draft",
      options: [
        {
          label: "Draft",
          value: "draft",
        },
        {
          label: "Published",
          value: "published",
        },
      ],
    },
    {
      name: "publishedAt",
      type: "date",
    },
    {
      name: "coverImageUrl",
      type: "text",
    },
    {
      name: "seoTitle",
      type: "text",
    },
    {
      name: "seoDescription",
      type: "textarea",
    },
  ],
};
