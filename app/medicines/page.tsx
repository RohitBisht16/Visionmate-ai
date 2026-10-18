import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "My Medicines · Visionmate AI" };

export default async function MedicinesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: medicines, error } = await supabase
    .from("user_medicines")
    .select("id, medicine_name, generic_name, active_ingredient, strength, dosage_form, frequency, duration, instructions, manufacturer, expiry_date, status, notes, created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-[#F5F8F7] px-4 py-6 text-ink sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between">
          <Link href="/dashboard" className="font-display text-2xl font-semibold">Visionmate AI</Link>
          <Link href="/dashboard" className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold">Dashboard</Link>
        </header>

        <section className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-signal">Medication list</p>
            <h1 className="mt-2 font-display text-4xl font-semibold">Active medicines</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">
              Medicines saved from your scans and prescriptions are shown here.
            </p>
          </div>
          <Link href="/scan" className="inline-flex items-center justify-center rounded-xl bg-signal px-5 py-3 text-sm font-bold text-white">
            Scan medicine
          </Link>
        </section>

        {error && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            We couldn't load your medicines. Please refresh and try again.
          </div>
        )}

        {!error && !medicines?.length && (
          <div className="mt-8 rounded-3xl border border-dashed border-line bg-white p-10 text-center">
            <p className="font-display text-2xl font-semibold">No active medicines</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/55">
              Save a medicine from a scan or save a prescription to add medicines to your list.
            </p>
          </div>
        )}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(medicines ?? []).map((medicine) => (
            <article key={medicine.id} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.12em] text-signal">Active</p>
                  <h2 className="mt-1 text-lg font-bold">{medicine.medicine_name}</h2>
                </div>
                <span className="rounded-full bg-[#E7F3F1] px-2.5 py-1 text-xs font-bold text-signal">Active</span>
              </div>
              {medicine.generic_name && <p className="mt-3 text-sm text-ink/60">Generic: {medicine.generic_name}</p>}
              {medicine.strength && <p className="mt-1 text-sm text-ink/60">Strength: {medicine.strength}</p>}
              {medicine.dosage_form && <p className="mt-1 text-sm text-ink/60">Form: {medicine.dosage_form}</p>}
              {medicine.frequency && <p className="mt-1 text-sm text-ink/60">Frequency: {medicine.frequency}</p>}
              {medicine.duration && <p className="mt-1 text-sm text-ink/60">Duration: {medicine.duration}</p>}
              {medicine.instructions && <p className="mt-3 rounded-xl bg-[#F5F8F7] p-3 text-xs leading-5 text-ink/55">{medicine.instructions}</p>}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
