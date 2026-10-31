// Numeric fields are plain text inputs (no type="number"); these keep only the
// characters a number can contain, so letters can't be typed or pasted in.

/** Digits only, for whole numbers such as scores and sort orders. */
export function toDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Digits and a single decimal point, for values such as hours. A comma counts as the point. */
export function toDecimal(value: string): string {
  const cleaned = value.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  return dot === -1 ? cleaned : cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
}
