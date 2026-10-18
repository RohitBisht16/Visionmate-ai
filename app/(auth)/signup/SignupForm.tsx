"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { isSupabaseConfigured } from "@/lib/utils";
import { CONFIG_MESSAGE, Field, FormMessage, SubmitButton } from "@/components/Field";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkEmail, setCheckEmail] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!isSupabaseConfigured) return setError(CONFIG_MESSAGE);
    if (password.length < 8) return setError("Use a password with at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");

    setLoading(true);
    try {
      const { data, error } = await createClient().auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: name.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });
      if (error) {
        setError(friendlyAuthError(error));
        setLoading(false);
        return;
      }
      // With email confirmation on, an existing address returns a user with no identities.
      if (data.user && data.user.identities?.length === 0) {
        setError(friendlyAuthError({ code: "user_already_exists" }));
        setLoading(false);
        return;
      }
      if (data.session) {
        router.replace("/dashboard");
        router.refresh();
      } else {
        setCheckEmail(true);
        setLoading(false);
      }
    } catch {
      setError(friendlyAuthError({ message: "network" }));
      setLoading(false);
    }
  }

  if (checkEmail) {
    return (
      <>
        <h1 className="font-display text-4xl">Check your email</h1>
        <div className="mt-6">
          <FormMessage kind="success">
            We sent a confirmation link to {email.trim()}. Open it to finish creating your account, then log in.
          </FormMessage>
        </div>
        <p className="mt-8 text-sm">
          <Link href="/login" className="font-medium text-signal underline underline-offset-2">Go to log in</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <div className="mb-8"><p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-signal">Get started</p><h1 className="font-display text-[38px] font-medium leading-tight sm:text-4xl">Create your Visionmate account</h1><p className="mt-2 text-sm leading-6 text-ink/60">Set up a private place to organize your medication information.</p></div>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        {!isSupabaseConfigured && <FormMessage kind="config">{CONFIG_MESSAGE}</FormMessage>}
        {error && <FormMessage kind="error">{error}</FormMessage>}
        <Field id="name" label="Full name" value={name} onChange={setName} autoComplete="name" disabled={loading} />
        <Field id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" disabled={loading} />
        <Field id="password" label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" hint="At least 8 characters." disabled={loading} />
        <Field id="confirm" label="Confirm password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" disabled={loading} />
        <SubmitButton loading={loading} loadingText="Creating account...">Create account</SubmitButton>
        <p className="text-sm text-ink/70">
          Visionmate AI provides information and potential safety flags. It does not replace a qualified healthcare
          professional.
        </p>
      </form>

      <p className="mt-8 text-sm">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-signal underline underline-offset-2">Log in</Link>
      </p>
    </>
  );
}
