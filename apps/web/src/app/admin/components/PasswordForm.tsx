"use client";

import React, { useState } from "react";
import { changePasswordAction } from "../actions";

export default function PasswordForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    const result = await changePasswordAction({ currentPassword, newPassword });

    if (result && result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {error && (
        <div style={{ color: "var(--accent)", padding: "12px", border: "1px solid var(--accent)", borderRadius: "4px", fontSize: "14px" }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ color: "#4CAF50", padding: "12px", border: "1px solid #4CAF50", borderRadius: "4px", fontSize: "14px" }}>
          Password changed successfully.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label htmlFor="currentPassword" style={{ fontSize: "14px", color: "var(--muted)" }}>Current Password</label>
        <input
          id="currentPassword"
          type="password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          style={{
            padding: "10px",
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--text)",
            fontFamily: "inherit",
            borderRadius: "4px",
            outline: "none",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label htmlFor="newPassword" style={{ fontSize: "14px", color: "var(--muted)" }}>New Password</label>
        <input
          id="newPassword"
          type="password"
          required
          minLength={6}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          style={{
            padding: "10px",
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--text)",
            fontFamily: "inherit",
            borderRadius: "4px",
            outline: "none",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label htmlFor="confirmPassword" style={{ fontSize: "14px", color: "var(--muted)" }}>Confirm New Password</label>
        <input
          id="confirmPassword"
          type="password"
          required
          minLength={6}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          style={{
            padding: "10px",
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--text)",
            fontFamily: "inherit",
            borderRadius: "4px",
            outline: "none",
          }}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "12px",
          background: "var(--text-heading)",
          color: "var(--bg)",
          border: "none",
          fontFamily: "inherit",
          fontWeight: "bold",
          borderRadius: "4px",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
          transition: "opacity 0.2s",
        }}
      >
        {loading ? "Changing..." : "Change Password"}
      </button>
    </form>
  );
}
