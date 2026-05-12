/**
 * Pure‑function page‑route auth guard.
 *
 * Determines whether a given pathname requires a Supabase session.
 * This keeps the decision logic easily testable outside the Edge
 * Runtime environment of proxy.ts.
 *
 * Rules:
 * - /dashboard, /account, /checkout, /protected, /admin → protected
 * - /checkout/success, /checkout/fail → public (payment return pages)
 * - /auth/*, /api/*, /cms/* → public (handled by their own guards)
 * - Everything else → public
 */

const publicCheckoutPaths = ["/checkout/success", "/checkout/fail"];

const protectedPrefixes = [
  "/protected",
  "/dashboard",
  "/account",
  "/checkout",
  "/admin",
];

/**
 * Returns `true` when the path requires an authenticated Supabase session.
 *
 * The function strips any query string before matching so callers can
 * pass raw `request.nextUrl.pathname` (which never contains a query
 * string) or a full URL path if convenient for tests.
 */
export function isProtectedPath(rawPathname: string): boolean {
  // Strip query string if accidentally included
  const pathname = rawPathname.split("?")[0];

  // Exclude public checkout return pages first (they start with /checkout)
  const isPublicCheckoutPath = publicCheckoutPaths.some((path) =>
    pathname.startsWith(path),
  );
  if (isPublicCheckoutPath) {
    return false;
  }

  // Exclude API routes (guarded separately by route handlers)
  if (pathname.startsWith("/api/")) {
    return false;
  }

  // Exclude Payload CMS admin (guarded by Payload's own auth)
  if (pathname.startsWith("/cms")) {
    return false;
  }

  return protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
}
