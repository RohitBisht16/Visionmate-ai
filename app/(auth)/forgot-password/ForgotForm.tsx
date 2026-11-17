"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const supabase = createClient();

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setStatus("Sending reset link...");

    // Step 2 implementation: points to the auth/confirm route handler
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/confirm?next=/update-password`,
    });

    if (error) {
      setStatus(`❌ Error: ${error.message}`);
    } else {
      setStatus("✅ Password reset link sent! Check your Gmail inbox.");
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-line bg-white p-6 shadow-sm">
      <h1 className="font-display text-2xl">Reset Password</h1>
      <p className="mt-1 text-sm text-ink/60">
        Enter your email address and we&apos;ll send you a link to reset your password.
      </p>

      <form onSubmit={handleResetRequest} className="mt-6 space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-ink/70">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="mt-1 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-signal focus:ring-2 focus:ring-signal/10"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-signal px-5 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Sending Link..." : "Send Reset Link"}
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