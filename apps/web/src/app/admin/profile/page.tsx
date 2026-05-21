import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import ProfileForm from "../components/ProfileForm";
import PasswordForm from "../components/PasswordForm";
import { getProfileAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const result = await getProfileAction();

  if ("error" in result || !result.data?.user) {
    redirect("/admin/login");
  }

  const profile = result.data.user as {
    email: string;
    username: string;
    displayName: string;
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <div style={{ marginBottom: "32px" }}>
        <Link href="/admin" style={{ color: "var(--muted)", textDecoration: "none" }}>← back to admin panel</Link>
      </div>

      <h1 style={{ marginBottom: "48px", fontSize: "20px" }}>Profile</h1>

      <section style={{ marginBottom: "64px" }}>
        <h2 style={{ marginBottom: "24px", fontSize: "16px" }}>Profile Information</h2>
        <ProfileForm initialData={profile} />
      </section>

      <section>
        <h2 style={{ marginBottom: "24px", fontSize: "16px" }}>Change Password</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
