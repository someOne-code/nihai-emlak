// Phase 8.6 Task 2: shared admin shell navigation contract.
// Phase 9A Task 2: extended with Icerik section and content sub-routes.
//
// Pure, framework-free helper so both the AdminSidebar component and
// tests can reason about the admin nav without pulling Next.js or
// React into node:test. The shell itself must not perform auth;
// page-level access guards remain authoritative.

export type AdminSidebarLink = {
  readonly label: string;
  readonly href: string;
};

export type AdminSidebarItem =
  | { readonly kind: "link"; readonly label: string; readonly href: string }
  | {
      readonly kind: "section";
      readonly label: string;
      readonly children: ReadonlyArray<AdminSidebarLink>;
    };

// Flat link list kept for backward compatibility with existing consumers
// that only need a simple link array.
export const ADMIN_SIDEBAR_LINKS: ReadonlyArray<AdminSidebarLink> =
  Object.freeze([
    Object.freeze({ label: "Dashboard", href: "/admin" }),
    Object.freeze({ label: "İlanlar", href: "/admin/listings" }),
    Object.freeze({ label: "Operasyonlar", href: "/admin/operations" }),
    Object.freeze({ label: "Adminler", href: "/admin/users" }),
    Object.freeze({ label: "CMS", href: "/cms" }),
  ]);

// Phase 9A: structured sidebar items with Icerik section grouping.
export const ADMIN_SIDEBAR_ITEMS: ReadonlyArray<AdminSidebarItem> =
  Object.freeze([
    Object.freeze({
      kind: "link" as const,
      label: "Dashboard",
      href: "/admin",
    }),
    Object.freeze({
      kind: "link" as const,
      label: "İlanlar",
      href: "/admin/listings",
    }),
    Object.freeze({
      kind: "link" as const,
      label: "Operasyonlar",
      href: "/admin/operations",
    }),
    Object.freeze({
      kind: "link" as const,
      label: "Adminler",
      href: "/admin/users",
    }),
    Object.freeze({
      kind: "section" as const,
      label: "İçerik",
      children: Object.freeze([
        Object.freeze({ label: "Blog Yazıları", href: "/admin/content/posts" }),
        Object.freeze({
          label: "Blog Kategorileri",
          href: "/admin/content/categories",
        }),
        Object.freeze({
          label: "Danışmanlar",
          href: "/admin/content/consultants",
        }),
      ]),
    }),
    Object.freeze({
      kind: "link" as const,
      label: "Fiyat Kataloğu",
      href: "/admin/listing-catalog",
    }),
    Object.freeze({ kind: "link" as const, label: "CMS", href: "/cms" }),
  ]);

type AdminTitleRule = {
  readonly prefix: string;
  readonly title: string;
};

// Order matters: longer prefixes must be evaluated before shorter ones
// so nested paths like "/admin/listings/abc" match "İlanlar" before
// falling back to the "/admin" dashboard label.
const ADMIN_TITLE_RULES: ReadonlyArray<AdminTitleRule> = Object.freeze([
  Object.freeze({ prefix: "/admin/users", title: "Adminler" }),
  Object.freeze({ prefix: "/admin/listing-catalog", title: "Fiyat Kataloğu" }),
  Object.freeze({ prefix: "/admin/listings", title: "İlanlar" }),
  Object.freeze({ prefix: "/admin/operations", title: "Operasyonlar" }),
  Object.freeze({ prefix: "/admin/content/posts", title: "Blog Yazıları" }),
  Object.freeze({
    prefix: "/admin/content/categories",
    title: "Blog Kategorileri",
  }),
  Object.freeze({ prefix: "/admin/content/consultants", title: "Danışmanlar" }),
  Object.freeze({ prefix: "/admin/content", title: "İçerik" }),
  Object.freeze({ prefix: "/admin", title: "Dashboard" }),
]);

const ADMIN_TITLE_EXACT: Readonly<Record<string, string>> = Object.freeze({
  "/admin": "Dashboard",
  "/admin/users": "Adminler",
  "/admin/listing-catalog": "Fiyat Kataloğu",
  "/admin/listings": "İlanlar",
  "/admin/operations": "Operasyonlar",
  "/admin/content/posts": "Blog Yazıları",
  "/admin/content/categories": "Blog Kategorileri",
  "/admin/content/consultants": "Danışmanlar",
});

const ADMIN_FALLBACK_TITLE = "Admin";

export function resolveAdminHeaderTitle(pathname: string): string {
  if (typeof pathname !== "string" || pathname.length === 0) {
    return ADMIN_FALLBACK_TITLE;
  }

  const exact = ADMIN_TITLE_EXACT[pathname];
  if (exact) {
    return exact;
  }

  for (const rule of ADMIN_TITLE_RULES) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      // The dashboard prefix "/admin" is intentionally last in the
      // rule list. Nested /admin/unknown paths fall through to the
      // fallback instead of being mislabelled as "Dashboard".
      if (rule.prefix === "/admin" && pathname !== "/admin") {
        return ADMIN_FALLBACK_TITLE;
      }
      return rule.title;
    }
  }

  return ADMIN_FALLBACK_TITLE;
}
