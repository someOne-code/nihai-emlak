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
