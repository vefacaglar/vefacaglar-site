import type { ComponentPropsWithRef } from "react";
import { buttonClassName, type ButtonVariant } from "./buttonClassName";

export type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: ButtonVariant;
};

/** Native button; form submission follows the standard HTML `type` attribute. */
export function Button({ variant = "accent", className, ...props }: ButtonProps) {
  return <button className={buttonClassName(variant, className)} {...props} />;
}

export type ButtonLinkProps = ComponentPropsWithRef<"a"> & {
  href: string;
  variant?: ButtonVariant;
};

/** Plain anchor. Router-specific navigation belongs to the consuming app. */
export function ButtonLink({ variant = "accent", className, ...props }: ButtonLinkProps) {
  return <a className={buttonClassName(variant, className)} {...props} />;
}
