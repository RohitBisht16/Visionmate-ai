"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Field, SubmitButton, FormMessage } from "@/components/Field";

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    if (error) {
      setMessage({ kind: "error", text: error.message });
    } else {
      setMessage({
        kind: "success",
        text: "Account created successfully! Check your email to confirm your account.",
      });
    }
    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F8F7] px-4 py-12 text-ink">
      <div className="w-full max-w-md rounded-3xl border border-line bg-white p-8 shadow-sm">
        <div className="mb-6">
          <Link href="/login" className="text-xs font-bold text-signal hover:underline">
            ← Back to Login
          </Link>
          <h1 className="mt-4 font-display text-2xl font-bold text-ink">Create an account</h1>
          <p className="mt-1 text-sm text-ink/60">Get started with Visionmate AI.</p>
        </div>

        {message && (
          <div className="mb-6">
            <FormMessage kind={message.kind}>{message.text}</FormMessage>
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <Field
            id="email"
            label="Email Address"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            required
          />

          <Field
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            hint="Must be at least 6 characters."
            required
          />

          <SubmitButton loading={loading} loadingText="Creating account...">
            Sign Up
          </SubmitButton>
        </form>

        <p className="mt-6 text-center text-sm text-ink/60">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-signal hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}