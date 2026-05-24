"use client";

import React, { useState } from "react";
import { updateProfileAction } from "../actions";
import formStyles from "./form.module.css";

import Button from "../../../components/Button";

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
    <form onSubmit={handleSubmit} className={formStyles.form}>
      {error && (
        <div className="errorMsg">
          {error}
        </div>
      )}

      {success && (
        <div className="successMsg">
          Profile updated successfully.
        </div>
      )}

      <div className="field">
        <label htmlFor="displayName" className="label">Display Name</label>
        <input
          id="displayName"
          type="text"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="input"
        />
      </div>

      <div className="field">
        <label htmlFor="email" className="label">Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
        />
      </div>

      <div className="field">
        <label htmlFor="username" className="label">Username</label>
        <input
          id="username"
          type="text"
          required
          minLength={3}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="input"
        />
      </div>

      <Button
        type="submit"
        disabled={loading}
      >
        {loading ? "Saving..." : "Save Profile"}
      </Button>
    </form>
  );
}
