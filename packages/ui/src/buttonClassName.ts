export type ButtonVariant = "accent" | "ghost";

/** Shared class names also work with a host router's link component. */
export function buttonClassName(variant: ButtonVariant = "accent", className = ""): string {
  const baseClass = variant === "accent" ? "btnAccent" : "btnGhost";
  return className ? `${baseClass} ${className}` : baseClass;
}
