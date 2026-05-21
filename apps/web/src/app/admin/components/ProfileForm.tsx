"use client";

import React, { useState } from "react";
import { updateProfileAction } from "../actions";

interface ProfileFormProps {
  initialData: {
    email: string;
    username: string;
    displayName: string;
  };
}

export default function ProfileForm({ initialData }: ProfileFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [email, setEmail] = useState(initialData.email);
  const [username, setUsername] = useState(initialData.username);
  const [displayName, setDisplayName] = useState(initialData.displayName);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const result = await updateProfileAction({ email, username, displayName });

    if (result && result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      setSuccess(true);
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
          Profile updated successfully.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label htmlFor="displayName" style={{ fontSize: "14px", color: "var(--muted)" }}>Display Name</label>
        <input
          id="displayName"
          type="text"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
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
        <label htmlFor="email" style={{ fontSize: "14px", color: "var(--muted)" }}>Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
        <label htmlFor="username" style={{ fontSize: "14px", color: "var(--muted)" }}>Username</label>
        <input
          id="username"
          type="text"
          required
          minLength={3}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
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
        {loading ? "Saving..." : "Save Profile"}
      </button>
    </form>
  );
}
