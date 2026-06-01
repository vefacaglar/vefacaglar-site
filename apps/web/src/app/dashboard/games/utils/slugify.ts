const TR_MAP: Record<string, string> = {
  "ç": "c", "Ç": "c", "ğ": "g", "Ğ": "g", "ı": "i", "I": "i", "İ": "i",
  "ö": "o", "Ö": "o", "ş": "s", "Ş": "s", "ü": "u", "Ü": "u",
};

export function slugify(text: string): string {
  let slugged = text;
  for (const key in TR_MAP) {
    slugged = slugged.replace(new RegExp(key, "g"), TR_MAP[key]);
  }
  return slugged
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}
