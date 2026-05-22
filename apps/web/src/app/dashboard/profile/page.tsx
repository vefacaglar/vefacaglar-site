import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import ProfileForm from "../components/ProfileForm";
import PasswordForm from "../components/PasswordForm";
import { getProfileAction } from "../actions";
import styles from "./profile.module.css";

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
        <Link href="/dashboard" className="backLink">← back to dashboard</Link>
      </div>

      <h1 className={styles.title}>Profile</h1>

      <section className={styles.profileSection}>
        <h2 className={styles.sectionTitle}>Profile Information</h2>
        <ProfileForm initialData={profile} />
      </section>

      <section>
        <h2 className={styles.sectionTitle}>Change Password</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
