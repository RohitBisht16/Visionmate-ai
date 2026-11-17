"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function PasswordChangeSection() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const supabase = createClient();

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    setStatus("");

    if (!password || !confirmPassword) {
      setStatus("❌ Please fill in both password fields.");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("❌ New passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setStatus("❌ Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      setStatus(`❌ Error: ${error.message}`);
    } else {
      setStatus("✅ Password updated successfully!");
      setPassword("");
      setConfirmPassword("");
    }
    setLoading(false);
  }

  return (
    <div className="rounded-3xl border border-line bg-white p-6 shadow-sm">
      <h2 className="font-display text-xl font-bold text-ink">Change Password</h2>
      <p className="mt-1 text-sm text-ink/60">
        Update your account password securely while logged in.
      </p>

      <form onSubmit={handlePasswordUpdate} className="mt-6 space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
            New Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="mt-1 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-signal focus:ring-2 focus:ring-signal/10"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
            Confirm New Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="mt-1 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-signal focus:ring-2 focus:ring-signal/10"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-signal px-5 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Updating Password..." : "Update Password"}
        </button>
      </form>

      {status && (
        <div className="mt-4 rounded-xl border border-line bg-[#F7FAF9] px-4 py-3 text-sm text-ink/80">
          {status}
        </div>
      )}
    </div>
  );
}