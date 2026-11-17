"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type UserSettingsData = {
  large_text: boolean;
  voice_language: "en-IN" | "hi-IN";
  voice_rate: "slow" | "normal";
  auto_speak_replies: boolean;
  expiry_alert_days: string;
  require_fingerprint_delete: boolean;
};

type Props = {
  email: string;
  initialSettings: UserSettingsData;
};

export default function SettingsForm({ email, initialSettings }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [settings, setSettings] = useState<UserSettingsData>(initialSettings);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  function toggleSetting<K extends keyof UserSettingsData>(
    key: K,
    value: UserSettingsData[K]
  ) {
    setSaved(false);
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          settings_large_text: settings.large_text,
          settings_voice_language: settings.voice_language,
          settings_voice_rate: settings.voice_rate,
          settings_auto_speak: settings.auto_speak_replies,
          settings_expiry_alert_days: settings.expiry_alert_days,
          settings_fingerprint_delete: settings.require_fingerprint_delete,
        },
      });

      if (updateError) throw updateError;

      if (typeof document !== "undefined") {
        document.documentElement.style.fontSize = settings.large_text
          ? "18px"
          : "16px";
      }

      setSaved(true);
      router.refresh();
    } catch (err: any) {
      console.error("Settings update error:", err);
      setError(err?.message || "Could not save settings. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordReset() {
    if (!email) return;
    setError("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/login`,
      }
    );
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setResetSent(true);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <form onSubmit={handleSave} className="mt-8 space-y-6">
      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {error}
        </div>
      )}

      {saved && (
        <div className="rounded-2xl border border-[#D4E6E2] bg-[#E7F3F1] p-4 text-sm font-semibold text-signal">
          Settings saved successfully.
        </div>
      )}

      {/* Section 1: Accessibility & Display */}
      <div className="rounded-3xl border border-line bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-signal">
          Accessibility
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          Reading &amp; display comfort
        </h2>

        <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl bg-[#F5F8F7] p-4">
          <div>
            <p className="text-base font-bold text-ink">
              Elder-Friendly Large Text
            </p>
            <p className="mt-0.5 text-xs leading-5 text-ink/60">
              Increases text size across medicine cards and instructions for
              easier reading.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.large_text}
            onClick={() => toggleSetting("large_text", !settings.large_text)}
            className={`relative h-8 w-14 shrink-0 rounded-full transition ${
              settings.large_text ? "bg-signal" : "bg-slate-300"
            }`}
          >
            <span
              className={`block h-6 w-6 rounded-full bg-white shadow transition ${
                settings.large_text ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Section 2: Voice Assistant Preferences */}
      <div className="rounded-3xl border border-line bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-signal">
          Voice assistant
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          Language &amp; speech speed
        </h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label>
            <span className="text-xs font-semibold text-ink/60">
              Preferred Voice Language
            </span>
            <select
              value={settings.voice_language}
              onChange={(e) =>
                toggleSetting(
                  "voice_language",
                  e.target.value as "en-IN" | "hi-IN"
                )
              }
              className="mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-signal"
            >
              <option value="en-IN">English / Hinglish (India)</option>
              <option value="hi-IN">Hindi (हिंदी)</option>
            </select>
          </label>

          <label>
            <span className="text-xs font-semibold text-ink/60">
              Speaking Speed
            </span>
            <select
              value={settings.voice_rate}
              onChange={(e) =>
                toggleSetting(
                  "voice_rate",
                  e.target.value as "slow" | "normal"
                )
              }
              className="mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-signal"
            >
              <option value="slow">Slow &amp; Clear (Recommended)</option>
              <option value="normal">Normal Pace</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-[#F5F8F7] p-4">
          <div>
            <p className="text-sm font-bold text-ink">
              Speak Replies Automatically
            </p>
            <p className="mt-0.5 text-xs text-ink/60">
              Read navigation confirmations and medicine answers aloud.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.auto_speak_replies}
            onClick={() =>
              toggleSetting("auto_speak_replies", !settings.auto_speak_replies)
            }
            className={`relative h-8 w-14 shrink-0 rounded-full transition ${
              settings.auto_speak_replies ? "bg-signal" : "bg-slate-300"
            }`}
          >
            <span
              className={`block h-6 w-6 rounded-full bg-white shadow transition ${
                settings.auto_speak_replies ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Section 3: Safety & Medication Alerts */}
      <div className="rounded-3xl border border-line bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-signal">
          Medication safety
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          Expiry alerts &amp; deletion lock
        </h2>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-ink/60">
              Warn Before Medicine Course Ends
            </span>
            <select
              value={settings.expiry_alert_days}
              onChange={(e) =>
                toggleSetting("expiry_alert_days", e.target.value)
              }
              className="mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-signal"
            >
              <option value="1">1 day before end date</option>
              <option value="2">2 days before end date (Default)</option>
              <option value="3">3 days before end date</option>
              <option value="5">5 days before end date</option>
            </select>
          </label>

          <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#F5F8F7] p-4">
            <div>
              <p className="text-sm font-bold text-ink">
                Fingerprint Protection for Deletion
              </p>
              <p className="mt-0.5 text-xs text-ink/60">
                Require biometric verification before removing medicines from
                your active list.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.require_fingerprint_delete}
              onClick={() =>
                toggleSetting(
                  "require_fingerprint_delete",
                  !settings.require_fingerprint_delete
                )
              }
              className={`relative h-8 w-14 shrink-0 rounded-full transition ${
                settings.require_fingerprint_delete
                  ? "bg-signal"
                  : "bg-slate-300"
              }`}
            >
              <span
                className={`block h-6 w-6 rounded-full bg-white shadow transition ${
                  settings.require_fingerprint_delete
                    ? "translate-x-7"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-signal px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
      >
        {busy ? "Saving settings..." : "Save Settings"}
      </button>

      {/* Section 4: Account Actions */}
      <div className="rounded-3xl border border-line bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-ink/50">
          Account
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold">
          Security &amp; session
        </h2>
        <p className="mt-1 text-xs text-ink/60">Signed in as {email}</p>

        {resetSent && (
          <p className="mt-3 rounded-xl bg-[#E7F3F1] p-3 text-xs font-semibold text-signal">
            Password reset link sent to {email}.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handlePasswordReset}
            className="rounded-xl border border-line bg-[#F5F8F7] px-4 py-2.5 text-xs font-bold text-ink hover:bg-[#E7F3F1]"
          >
            Send Password Reset Email
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100"
          >
            Log Out
          </button>
        </div>
      </div>
    </form>
  );
}