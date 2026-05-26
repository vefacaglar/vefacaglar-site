import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import ProfileForm from "../components/ProfileForm";
import PasswordForm from "../components/PasswordForm";
import { getProfileAction } from "../actions";
import styles from "./profile.module.css";
import ds from "../../../lib/dashboard-strings";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const result = await getProfileAction();

  if ("error" in result || !result.data?.user) {
    redirect("/dashboard/login");
  }

  const profile = result.data.user as {
    email: string;
    username: string;
    displayName: string;
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.back}>
        <Link href="/dashboard" className="backLink">{ds.profile.backToDashboard}</Link>
      </div>

      <h1 className={styles.title}>{ds.profile.title}</h1>

      <section className={styles.profileSection}>
        <h2 className={styles.sectionTitle}>{ds.profile.profileInfo}</h2>
        <ProfileForm initialData={profile} />
      </section>

      <section>
        <h2 className={styles.sectionTitle}>{ds.profile.changePassword}</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
