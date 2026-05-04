// Turkish-aware slug generator for admin listing titles.
// Converts Turkish characters (ç, ğ, ı, ö, ş, ü) to ASCII equivalents,
// lowercases, strips non-alphanumeric characters, and collapses whitespace
// into single hyphens.

const TURKISH_MAP: ReadonlyArray<readonly [string, string]> = [
  ["ç", "c"],
  ["Ç", "c"],
  ["ğ", "g"],
  ["Ğ", "g"],
  ["ı", "i"],
  ["İ", "i"],
  ["ö", "o"],
  ["Ö", "o"],
  ["ş", "s"],
  ["Ş", "s"],
  ["ü", "u"],
  ["Ü", "u"],
];

export function slugify(text: string): string {
  let result = text.trim();

  for (const [from, to] of TURKISH_MAP) {
    result = result.replaceAll(from, to);
  }

  return result
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
