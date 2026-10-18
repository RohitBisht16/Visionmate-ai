"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { isSupabaseConfigured } from "@/lib/utils";
import { CONFIG_MESSAGE, Field, FormMessage, SubmitButton } from "@/components/Field";

export function ResetForm() {
  const router = useRouter();
  const [ready, setReady] = useState<"checking" | "yes" | "no">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return setReady("no");
    createClient().auth.getUser().then(({ data }) => setReady(data.user ? "yes" : "no"));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Use a password with at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setLoading(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) {
        setError(friendlyAuthError(error));
        setLoading(false);
        return;
      }
      setDone(true);
      setTimeout(() => {
        router.replace("/dashboard");
        router.refresh();
      }, 1500);
    } catch {
      setError(friendlyAuthError({ message: "network" }));
      setLoading(false);
    }
  }

  if (ready === "checking") return <p role="status">Checking your reset link...</p>;

  if (ready === "no") {
    return (
      <>
        <h1 className="font-display text-[38px] font-medium">Link not valid</h1>
        <div className="mt-6">
          <FormMessage kind="error">
            {isSupabaseConfigured ? "This reset link has expired or was already used." : CONFIG_MESSAGE}
          </FormMessage>
        </div>
        <p className="mt-8 text-sm">
          <Link href="/forgot-password" className="font-medium text-signal underline underline-offset-2">
            Request a new link
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <div className="mb-8"><p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-signal">Account recovery</p><h1 className="font-display text-[38px] font-medium leading-tight sm:text-4xl">Choose a new password</h1><p className="mt-2 text-sm leading-6 text-ink/60">Create a new password to secure your account.</p></div>
      {done ? (
        <div className="mt-8"><FormMessage kind="success">Password updated. Taking you to your dashboard.</FormMessage></div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          {error && <FormMessage kind="error">{error}</FormMessage>}
          <Field id="password" label="New password" type="password" value={password} onChange={setPassword} autoComplete="new-password" hint="At least 8 characters." disabled={loading} />
          <Field id="confirm" label="Confirm new password" type="password" value={confirm} onChange={setConfirm} autoComplete="new-password" disabled={loading} />
          <SubmitButton loading={loading} loadingText="Saving...">Save new password</SubmitButton>
        </form>
      )}
    </>
  );
}
