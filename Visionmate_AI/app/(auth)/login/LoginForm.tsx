"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { isSupabaseConfigured, safeNext } from "@/lib/utils";
import { CONFIG_MESSAGE, Field, FormMessage, SubmitButton } from "@/components/Field";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    params.get("error") === "link" ? "That link has expired or was already used. Request a new one." : ""
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!isSupabaseConfigured) return setError(CONFIG_MESSAGE);
    setLoading(true);
    try {
      const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setError(friendlyAuthError(error));
        setLoading(false);
        return;
      }
      router.replace(safeNext(params.get("next")));
      router.refresh();
    } catch {
      setError(friendlyAuthError({ message: "network" }));
      setLoading(false);
    }
  }

  return (
    <>
      <div className="mb-8"><p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-signal">Welcome back</p><h1 className="font-display text-[38px] font-medium leading-tight sm:text-4xl">Sign in to Visionmate</h1><p className="mt-2 max-w-sm text-sm leading-6 text-ink/60">Continue to your private medication workspace.</p></div>

      <form onSubmit={onSubmit} className="space-y-5" noValidate={false}>
        {!isSupabaseConfigured && <FormMessage kind="config">{CONFIG_MESSAGE}</FormMessage>}
        {error && <FormMessage kind="error">{error}</FormMessage>}
        <Field id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" disabled={loading} />
        <Field id="password" label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" disabled={loading} />
        <div className="text-right">
          <Link href="/forgot-password" className="text-sm font-medium text-signal underline underline-offset-2">
            Forgot your password?
          </Link>
        </div>
        <SubmitButton loading={loading} loadingText="Logging in...">Log in</SubmitButton>
      </form>

      <p className="mt-8 text-sm">
        New to Visionmate AI?{" "}
        <Link href="/signup" className="font-medium text-signal underline underline-offset-2">Create an account</Link>
      </p>
    </>
  );
}
