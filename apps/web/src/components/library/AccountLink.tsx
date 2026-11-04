"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./LibraryShell.module.css";

/**
 * The signed-in user's link to their own profile. A client component so it can
 * light up on the owner's own profile pages and settings, even across client-side
 * navigations that keep the server-rendered shell in place.
 */
export default function AccountLink({
  href,
  profilePath,
  label,
}: {
  href: string;
  /** Unlocalized path of the user's profile, e.g. `/profile/vefa`. */
  profilePath: string;
  label: string;
}) {
  const pathname = usePathname() || "/";
  const ownPath = decodeURIComponent(profilePath).toLowerCase();
  const current = decodeURIComponent(pathname).toLowerCase();
  const active =
    current === ownPath || current.startsWith(`${ownPath}/`) || current === "/profile/settings";

  return (
    <Link
      href={href}
      className={active ? `${styles.account} ${styles.accountActive}` : styles.account}
      aria-current={active ? "page" : undefined}
    >
      {label}
    </Link>
  );
}
