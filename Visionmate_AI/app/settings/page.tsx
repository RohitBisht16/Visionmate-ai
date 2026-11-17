import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SettingsForm, { UserSettingsData } from "@/components/SettingsForm";

export const metadata = { title: "Settings · Visionmate AI" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const meta = user.user_metadata ?? {};

  const initialSettings: UserSettingsData = {
    large_text: Boolean(meta.settings_large_text ?? false),
    voice_language:
      meta.settings_voice_language === "hi-IN" ? "hi-IN" : "en-IN",
    voice_rate: meta.settings_voice_rate === "normal" ? "normal" : "slow",
    auto_speak_replies: Boolean(meta.settings_auto_speak ?? true),
    expiry_alert_days: String(meta.settings_expiry_alert_days ?? "2"),
    require_fingerprint_delete: Boolean(
      meta.settings_fingerprint_delete ?? true
    ),
  };

  return (
    <main className="min-h-screen bg-[#F5F8F7] px-4 py-6 text-ink sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="font-display text-2xl font-semibold"
          >
            Visionmate AI
          </Link>
          <div className="flex gap-2">
            <Link
              href="/profile"
              className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold"
            >
              Profile
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold"
            >
              Dashboard
            </Link>
          </div>
        </header>

        <section className="mt-8">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-signal">
            Preferences
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            App &amp; accessibility settings
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">
            Customize reading comfort, voice assistant speed, and medication
            safety alerts.
          </p>
        </section>

        <SettingsForm
          email={user.email ?? ""}
          initialSettings={initialSettings}
        />
      </div>
    </main>
  );
}