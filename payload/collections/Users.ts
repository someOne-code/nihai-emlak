import type { CollectionConfig } from "payload";

type PayloadUserAccessArgs = {
  req: {
    user?: {
      collection?: string | null;
      id?: number | string | null;
      role?: string | null;
    } | null;
  };
};

type OwnUserWhere = {
  id: {
    equals: number | string;
  };
};

export function canAccessPayloadAdmin(args: PayloadUserAccessArgs): boolean {
  return isPayloadAdmin(args.req.user);
}

export function canManagePayloadUsers(args: PayloadUserAccessArgs): boolean {
  return isPayloadAdmin(args.req.user);
}

export function canReadPayloadUsers(args: PayloadUserAccessArgs): boolean | OwnUserWhere {
  return canAccessOwnPayloadUser(args);
}

export function canUpdatePayloadUsers(args: PayloadUserAccessArgs): boolean | OwnUserWhere {
  return canAccessOwnPayloadUser(args);
}

export const Users = {
  slug: "users",
  auth: true,
  access: {
    admin: canAccessPayloadAdmin,
    create: canManagePayloadUsers,
    read: canReadPayloadUsers,
    update: canUpdatePayloadUsers,
    delete: canManagePayloadUsers,
    unlock: canManagePayloadUsers,
  },
  admin: {
    useAsTitle: "email",
  },
  fields: [
    {
      name: "fullName",
      type: "text",
    },
    {
      name: "role",
      type: "select",
      defaultValue: "editor",
      required: true,
      access: {
        update: canManagePayloadUsers,
      },
      options: [
        {
          label: "Admin",
          value: "admin",
        },
        {
          label: "Editor",
          value: "editor",
        },
      ],
    },
  ],
} satisfies CollectionConfig;

function canAccessOwnPayloadUser(args: PayloadUserAccessArgs): boolean | OwnUserWhere {
  if (isPayloadAdmin(args.req.user)) {
    return true;
  }

  const userId = args.req.user?.id;
  if (typeof userId === "string" || typeof userId === "number") {
    return {
      id: {
        equals: userId,
      },
    };
  }

  return false;
}

function isPayloadAdmin(user: PayloadUserAccessArgs["req"]["user"]): boolean {
  return user?.collection === "users" && user.role === "admin";
}
