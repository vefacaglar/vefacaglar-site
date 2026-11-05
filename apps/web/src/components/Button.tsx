import React from "react";
import Link from "next/link";
import { Button as NativeButton, buttonClassName } from "@vefacaglar/ui";

interface BaseButtonProps {
  variant?: "accent" | "ghost";
  children: React.ReactNode;
}

type ButtonAsButtonProps = BaseButtonProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: never;
  };

type ButtonAsLinkProps = BaseButtonProps &
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  };

export type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

export default function Button({
  variant = "accent",
  children,
  className = "",
  href,
  ...props
}: ButtonProps) {
  const combinedClassName = buttonClassName(variant, className);

  if (href !== undefined) {
    const linkProps = props as React.AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <Link href={href} className={combinedClassName} {...linkProps}>
        {children}
      </Link>
    );
  }

  const buttonProps = props as React.ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <NativeButton variant={variant} className={className} {...buttonProps}>
      {children}
    </NativeButton>
  );
}
