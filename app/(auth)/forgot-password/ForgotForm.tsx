"use client";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { isSupabaseConfigured } from "@/lib/utils";
import { CONFIG_MESSAGE, Field, FormMessage, SubmitButton } from "@/components/Field";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!isSupabaseConfigured) return setError(CONFIG_MESSAGE);
    setLoading(true);
    try {
      const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) setError(friendlyAuthError(error));
      else setSent(true);
    } catch {
      setError(friendlyAuthError({ message: "network" }));
    }
    setLoading(false);
  }

  return (
    <>
      <div className="mb-8"><p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-signal">Account recovery</p><h1 className="font-display text-[38px] font-medium leading-tight sm:text-4xl">Reset your password</h1><p className="mt-2 text-sm leading-6 text-ink/60">Enter your email and we’ll send a secure reset link.</p></div>

      {sent ? (
        <div className="mt-8">
          <FormMessage kind="success">
            If an account exists for {email.trim()}, a reset link is on its way. Check your inbox and spam folder.
          </FormMessage>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          {!isSupabaseConfigured && <FormMessage kind="config">{CONFIG_MESSAGE}</FormMessage>}
          {error && <FormMessage kind="error">{error}</FormMessage>}
          <Field id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" disabled={loading} />
          <SubmitButton loading={loading} loadingText="Sending link...">Send reset link</SubmitButton>
        </form>
      )}

      <p className="mt-8 text-sm">
        <Link href="/login" className="font-medium text-signal underline underline-offset-2">Back to log in</Link>
      </p>
    </>
  );
}
