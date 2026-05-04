// Phase 9A: Shared slugify helper with Turkish character normalization.
//
// Used by posts, categories, and consultants parsers to auto-generate
// URL-safe slugs from human-readable titles/names.
//
// Reusable across all content admin forms; importable without side-effects.

const TURKISH_CHAR_MAP: Record<string, string> = {
  ç: "c",
  Ç: "c",
  ğ: "g",
  Ğ: "g",
  ı: "i",
  İ: "i",
  ö: "o",
  Ö: "o",
  ş: "s",
  Ş: "s",
  ü: "u",
  Ü: "u",
};

/**
 * Convert a human-readable title (Turkish or otherwise) into a URL-safe slug.
 *
 * Rules:
 * - Normalize Turkish characters: ç→c, ğ→g, ı→i, ö→o, ş→s, ü→u
 * - Lowercase the result
 * - Replace any non-alphanumeric character with a single hyphen
 * - Collapse consecutive hyphens
 * - Trim leading/trailing hyphens
 * - Return empty string for empty/whitespace-only input
 */
export function slugifyTitle(title: string): string {
  if (!title || title.trim().length === 0) return "";

  let result = "";
  for (const ch of title.trim()) {
    const mapped = TURKISH_CHAR_MAP[ch];
    if (mapped !== undefined) {
      result += mapped;
    } else {
      result += ch;
    }
  }

  // Lowercase, then replace non-alphanumeric sequences with single hyphen
  const lower = result.toLowerCase();
  let slug = "";
  let lastWasHyphen = false;
  for (const ch of lower) {
    if ((ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9")) {
      slug += ch;
      lastWasHyphen = false;
    } else if (!lastWasHyphen) {
      slug += "-";
      lastWasHyphen = true;
    }
  }

  // Trim leading/trailing hyphens
  return slug.replace(/^-+|-+$/g, "");
}
