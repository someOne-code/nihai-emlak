type PayloadUserAccessArgs = {
  req: {
    user?: {
      collection?: string | null;
      id?: number | string | null;
      role?: string | null;
    } | null;
  };
};

type ContentWhereFilter = {
  [key: string]: {
    equals: string | boolean;
  };
};

function isPayloadAdmin(user: PayloadUserAccessArgs["req"]["user"]): boolean {
  return user?.collection === "users" && user.role === "admin";
}

export function isAdminContentManager(args: PayloadUserAccessArgs): boolean {
  return isPayloadAdmin(args.req.user);
}

export function canCreateContent(args: PayloadUserAccessArgs): boolean {
  return isPayloadAdmin(args.req.user);
}

export function canUpdateContent(args: PayloadUserAccessArgs): boolean {
  return isPayloadAdmin(args.req.user);
}

export function canDeleteContent(args: PayloadUserAccessArgs): boolean {
  return isPayloadAdmin(args.req.user);
}

function publishedBlogWhere(): ContentWhereFilter {
  return {
    status: {
      equals: "published",
    },
  };
}

function activeCategoryWhere(): ContentWhereFilter {
  return {
    isActive: {
      equals: true,
    },
  };
}

function publishedConsultantWhere(): ContentWhereFilter {
  return {
    isPublished: {
      equals: true,
    },
  };
}

export function publishedBlogReadFilter(
  args?: PayloadUserAccessArgs,
): true | ContentWhereFilter {
  if (args && isPayloadAdmin(args.req.user)) {
    return true;
  }
  return publishedBlogWhere();
}

export function activeCategoryReadFilter(
  args?: PayloadUserAccessArgs,
): true | ContentWhereFilter {
  if (args && isPayloadAdmin(args.req.user)) {
    return true;
  }
  return activeCategoryWhere();
}

export function publishedConsultantReadFilter(
  args?: PayloadUserAccessArgs,
): true | ContentWhereFilter {
  if (args && isPayloadAdmin(args.req.user)) {
    return true;
  }
  return publishedConsultantWhere();
}
