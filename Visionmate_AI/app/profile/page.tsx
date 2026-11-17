import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileForm, { UserProfileData } from "@/components/ProfileForm";

export const metadata = { title: "My Profile · Visionmate AI" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const meta = user.user_metadata ?? {};

  const initialData: UserProfileData = {
    full_name: meta.full_name ?? "",
    age: meta.age ?? "",
    blood_group: meta.blood_group ?? "",
    phone: meta.phone ?? "",
    allergies: meta.allergies ?? "",
    chronic_conditions: meta.chronic_conditions ?? "",
    emergency_contact_name: meta.emergency_contact_name ?? "",
    emergency_contact_phone: meta.emergency_contact_phone ?? "",
    doctor_name: meta.doctor_name ?? "",
    doctor_phone: meta.doctor_phone ?? "",
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
              href="/history"
              className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold"
            >
              History
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
            Patient profile
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Health &amp; emergency details
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">
            Keep your allergies, blood group, and caregiver contact updated for
            quick reference during doctor visits or emergencies.
          </p>
        </section>

        <ProfileForm email={user.email ?? ""} initialData={initialData} />
      </div>
    </main>
  );
}