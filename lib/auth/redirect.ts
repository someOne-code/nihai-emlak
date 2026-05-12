export function resolveSafeAuthRedirect(
  redirectTo: string | null | undefined,
  fallback = "/admin",
): string {
  if (
    typeof redirectTo === "string" &&
    redirectTo.startsWith("/") &&
    !redirectTo.startsWith("//")
  ) {
    return redirectTo;
  }

  return fallback;
}

export function getLoginRedirectUrl(currentPath: string): string {
  const safePath = resolveSafeAuthRedirect(currentPath, "/");
  return `/auth/login?redirect=${encodeURIComponent(safePath)}`;
}
