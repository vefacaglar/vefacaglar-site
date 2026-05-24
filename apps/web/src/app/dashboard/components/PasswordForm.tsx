"use client";

import React, { useState } from "react";
import { changePasswordAction } from "../actions";
import formStyles from "./form.module.css";

import Button from "../../../components/Button";

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
    <form onSubmit={handleSubmit} className={formStyles.form}>
      {error && (
        <div className="errorMsg">
          {error}
        </div>
      )}

      {success && (
        <div className="successMsg">
          Password changed successfully.
        </div>
      )}

      <div className="field">
        <label htmlFor="currentPassword" className="label">Current Password</label>
        <input
          id="currentPassword"
          type="password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="input"
        />
      </div>

      <div className="field">
        <label htmlFor="newPassword" className="label">New Password</label>
        <input
          id="newPassword"
          type="password"
          required
          minLength={6}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="input"
        />
      </div>

      <div className="field">
        <label htmlFor="confirmPassword" className="label">Confirm New Password</label>
        <input
          id="confirmPassword"
          type="password"
          required
          minLength={6}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="input"
        />
      </div>

      <Button
        type="submit"
        disabled={loading}
      >
        {loading ? "Changing..." : "Change Password"}
      </Button>
    </form>
  );
}
