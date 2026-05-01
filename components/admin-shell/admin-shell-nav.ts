// Phase 8.6 Task 2: shared admin shell navigation contract.
//
// Pure, framework-free helper so both the AdminSidebar component and
// tests can reason about the admin nav without pulling Next.js or
// React into node:test. The shell itself must not perform auth;
// page-level access guards remain authoritative.

export type AdminSidebarLink = {
  readonly label: string;
  readonly href: string;
};

export const ADMIN_SIDEBAR_LINKS: ReadonlyArray<AdminSidebarLink> =
  Object.freeze([
    Object.freeze({ label: "Dashboard", href: "/admin" }),
    Object.freeze({ label: "İlanlar", href: "/admin/listings" }),
    Object.freeze({ label: "Operasyonlar", href: "/admin/operations" }),
    Object.freeze({ label: "CMS", href: "/cms" }),
  ]);

type AdminTitleRule = {
  readonly prefix: string;
  readonly title: string;
};

// Order matters: longer prefixes must be evaluated before shorter ones
// so nested paths like "/admin/listings/abc" match "İlanlar" before
// falling back to the "/admin" dashboard label.
const ADMIN_TITLE_RULES: ReadonlyArray<AdminTitleRule> = Object.freeze([
  Object.freeze({ prefix: "/admin/listings", title: "İlanlar" }),
  Object.freeze({ prefix: "/admin/operations", title: "Operasyonlar" }),
  Object.freeze({ prefix: "/admin", title: "Dashboard" }),
]);

const ADMIN_TITLE_EXACT: Readonly<Record<string, string>> = Object.freeze({
  "/admin": "Dashboard",
  "/admin/listings": "İlanlar",
  "/admin/operations": "Operasyonlar",
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
