"use client";

import React, { useState } from "react";
import Link from "next/link";
import { loginAction } from "../actions";
import styles from "./login.module.css";
import formStyles from "../components/form.module.css";

export default function AdminLogin() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await loginAction(null, formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.back}>
        <Link href="/" className="backLink">← back to home</Link>
      </div>

      <h1 className={styles.title}>Admin Login</h1>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className="field">
          <label htmlFor="email" className="label">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="admin@vefacaglar.com"
            className="input"
          />
        </div>

        <div className="field">
          <label htmlFor="password" className="label">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            placeholder="••••••"
            className="input"
          />
        </div>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={formStyles.submitSm}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
