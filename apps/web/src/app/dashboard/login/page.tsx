"use client";

import React, { useState } from "react";
import Link from "next/link";
import { loginAction } from "../actions";
import styles from "./login.module.css";
import formStyles from "../components/form.module.css";
import Button from "../../../components/Button";
import ds from "../../../lib/dashboard-strings";

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
        <Link href="/" className="backLink">{ds.login.backToHome}</Link>
      </div>

      <h1 className={styles.title}>{ds.login.title}</h1>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className="field">
          <label htmlFor="email" className="label">{ds.login.email}</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder={ds.login.emailPlaceholder}
            className="input"
          />
        </div>

        <div className="field">
          <label htmlFor="password" className="label">{ds.login.password}</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            placeholder={ds.login.passwordPlaceholder}
            className="input"
          />
        </div>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className={styles.submitBtn}
        >
          {loading ? ds.login.signingIn : ds.login.signIn}
        </Button>
      </form>
    </div>
  );
}
