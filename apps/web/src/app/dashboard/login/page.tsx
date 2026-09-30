import React from "react";
import Link from "next/link";
import PasswordLoginForm from "./PasswordLoginForm";
import styles from "./login.module.css";
import ds from "../../../lib/dashboard-strings";
import { getAuthMode } from "../../../lib/oidc";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: { error?: string; reason?: string };
}

export default function AdminLogin({ searchParams }: PageProps) {
  const errorKey = searchParams.error as keyof typeof ds.login.errors | undefined;
  const error = errorKey ? ds.login.errors[errorKey] : undefined;
  const reason = process.env.NODE_ENV !== "production" ? searchParams.reason : undefined;

  return (
    <div className={styles.wrapper}>
      <div className={styles.back}>
        <Link href="/" className="backLink">{ds.login.backToHome}</Link>
      </div>

      <h1 className={styles.title}>{ds.login.title}</h1>

      {getAuthMode() === "oidc" ? (
        <div className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          {reason && <div className={styles.error}>{reason}</div>}
          {/* Plain anchor: next/link would prefetch the route handler and start a login flow. */}
          <a href="/dashboard/login/oidc" className={`btnAccent ${styles.submitBtn}`}>
            {ds.login.signInWithProvider}
          </a>
        </div>
      ) : (
        <PasswordLoginForm />
      )}
    </div>
  );
}
