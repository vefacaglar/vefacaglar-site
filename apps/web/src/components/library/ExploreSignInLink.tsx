"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "./LibraryShell.module.css";

export default function ExploreSignInLink({ label, oidc }: { label: string; oidc: boolean }) {
  const pathname = usePathname() || "/explore";
  const query = useSearchParams().toString();
  const returnTo = `${pathname}${query ? `?${query}` : ""}`;
  const href = oidc ? `/dashboard/login/oidc?returnTo=${encodeURIComponent(returnTo)}` : "/dashboard/login";
  return <Link href={href} className={styles.account}>{label}</Link>;
}
