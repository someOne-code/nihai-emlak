/**
 * Shared image URL validation helper.
 *
 * Used by Payload CMS field validation on coverImageUrl, photoUrl,
 * and any other image URL text fields to ensure admins enter absolute
 * URLs (http:// or https://) instead of relative paths.
 */

/**
 * Returns `true` when the value is a valid absolute image URL
 * (http or https), or when the value is empty/null/undefined
 * (the field is optional).
 */
export function isAbsoluteImageUrl(value?: string | null): boolean {
  if (!value || value.trim().length === 0) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Payload CMS `validate` function for image URL text fields.
 *
 * Returns `true` on valid input, or a descriptive error string
 * when the value is not an absolute http(s) URL.
 */
export function validateImageUrl(
  value: string | null | undefined,
): true | string {
  if (isAbsoluteImageUrl(value)) {
    return true;
  }
  return "Görsel URL'si tam (absolute) olmalıdır. Örnek: https://cdn.nihaiemlak.com/image.jpg";
}
