"use client";

import React, { useState } from "react";
import Link from "next/link";
import { loginAction } from "../actions";

export default function AdminLogin() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await loginAction(null, formData);

    if (result && result.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "400px", margin: "100px auto 0 auto" }}>
      <div style={{ marginBottom: "48px" }}>
        <Link href="/" style={{ color: "var(--muted)", textDecoration: "none" }}>← back to home</Link>
      </div>

      <h1 style={{ marginBottom: "32px", fontSize: "20px" }}>Admin Girişi</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label htmlFor="email" style={{ fontSize: "14px", color: "var(--muted)" }}>E-posta</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="admin@vefacaglar.com"
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
          <label htmlFor="password" style={{ fontSize: "14px", color: "var(--muted)" }}>Şifre</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            placeholder="••••••"
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

        {error && (
          <div style={{ color: "var(--accent)", fontSize: "14px" }}>
            {error}
          </div>
        )}

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
          {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
        </button>
      </form>
    </div>
  );
}
