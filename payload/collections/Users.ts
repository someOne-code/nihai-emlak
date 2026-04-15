import type { CollectionConfig } from "payload";

export const Users = {
  slug: "users",
  auth: true,
  admin: {
    useAsTitle: "email",
  },
  fields: [
    {
      name: "fullName",
      type: "text",
    },
  ],
} satisfies CollectionConfig;
