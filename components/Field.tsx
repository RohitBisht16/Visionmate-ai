"use client";
import { useState } from "react";

type Props = {
  id: string; label: string; type?: "text" | "email" | "password"; value: string; onChange: (v: string) => void;
  autoComplete?: string; hint?: string; required?: boolean; disabled?: boolean;
};

export function Field({ id, label, type = "text", value, onChange, autoComplete, hint, required = true, disabled }: Props) {
  const [shown, setShown] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-[13px] font-semibold tracking-[0.01em] text-ink/85">{label}</label>
      <div className="relative">
        <input
          id={id} name={id} type={isPassword && shown ? "text" : type} value={value}
          onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required={required} disabled={disabled}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className="h-[52px] w-full rounded-xl border border-[#D8E2E0] bg-[#FAFCFB] px-4 text-[15px] text-ink shadow-sm outline-none transition placeholder:text-ink/35 focus:border-signal focus:bg-white focus:ring-4 focus:ring-[#0B6E6D]/10 disabled:cursor-not-allowed disabled:opacity-60"
        />
        {isPassword && (
          <button type="button" onClick={() => setShown((s) => !s)} aria-pressed={shown} aria-label={shown ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 px-4 text-xs font-bold text-signal transition hover:text-signal-dark">
            {shown ? "Hide" : "Show"}
          </button>
        )}
      </div>
      {hint && <p id={`${id}-hint`} className="text-xs leading-5 text-ink/55">{hint}</p>}
    </div>
  );
}

export function FormMessage({ kind, children }: { kind: "error" | "success" | "config"; children: React.ReactNode }) {
  const styles = kind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-orange-200 bg-orange-50 text-orange-950";
  const label = kind === "success" ? "Success" : kind === "config" ? "Setup needed" : "Something went wrong";
  return <div role={kind === "success" ? "status" : "alert"} className={`rounded-xl border px-4 py-3 text-sm ${styles}`}><strong className="mr-1 font-bold">{label}.</strong>{children}</div>;
}

export function SubmitButton({ loading, children, loadingText }: { loading: boolean; children: React.ReactNode; loadingText: string }) {
  return (
    <button type="submit" disabled={loading} className="group relative h-[52px] w-full overflow-hidden rounded-xl bg-signal px-4 text-[15px] font-bold text-white shadow-[0_10px_24px_rgba(11,110,109,.18)] transition hover:-translate-y-0.5 hover:bg-signal-dark hover:shadow-[0_14px_30px_rgba(11,110,109,.24)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70">
      <span className="relative z-10">{loading ? loadingText : children}</span>
    </button>
  );
}

export const CONFIG_MESSAGE = "Supabase isn't configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local and restart the server.";
