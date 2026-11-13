import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DeleteMedicineButton from "@/components/DeleteMedicineButton";

export const metadata = { title: "My Medicines · Visionmate AI" };

function computeDaysRemaining(
  expiryDate: string | null,
  createdAt: string,
  duration: string | null
): { daysLeft: number | null; endDateLabel: string | null } {
  let targetDate: Date | null = null;

  if (expiryDate) {
    targetDate = new Date(expiryDate);
  } else if (duration && createdAt) {
    const match = duration.match(
      /(\d+)\s*(day|days|d|week|weeks|wk|wks|month|months|mo|mos)\b/i
    );
    if (match) {
      const amount = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      targetDate = new Date(createdAt);

      if (unit.startsWith("d")) {
        targetDate.setDate(targetDate.getDate() + amount);
      } else if (unit.startsWith("w")) {
        targetDate.setDate(targetDate.getDate() + amount * 7);
      } else if (unit.startsWith("m")) {
        targetDate.setMonth(targetDate.getMonth() + amount);
      }
    }
  }

  if (!targetDate || isNaN(targetDate.getTime())) {
    return { daysLeft: null, endDateLabel: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(targetDate);
  end.setHours(0, 0, 0, 0);

  const diffMs = end.getTime() - today.getTime();
  const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));

  return {
    daysLeft,
    endDateLabel: end.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  };
}

export default async function MedicinesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: medicines, error } = await supabase
    .from("user_medicines")
    .select(
      "id, medicine_name, generic_name, active_ingredient, strength, dosage_form, frequency, duration, instructions, manufacturer, expiry_date, status, notes, created_at"
    )
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-[#F5F8F7] px-4 py-6 text-ink sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="font-display text-2xl font-semibold"
          >
            Visionmate AI
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold"
          >
            Dashboard
          </Link>
        </header>

        <section className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-signal">
              Medication list
            </p>
            <h1 className="mt-2 font-display text-4xl font-semibold">
              Active medicines
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">
              Medicines saved from your scans and prescriptions are tracked
              here with automatic duration and expiry alerts.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/prescription/scan"
              className="inline-flex items-center justify-center rounded-xl border border-line bg-white px-5 py-3 text-sm font-bold text-ink"
            >
              Scan prescription
            </Link>
            <Link
              href="/scan"
              className="inline-flex items-center justify-center rounded-xl bg-signal px-5 py-3 text-sm font-bold text-white"
            >
              Scan medicine
            </Link>
          </div>
        </section>

        {error && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            We couldn&apos;t load your medicines. Please refresh and try again.
          </div>
        )}

        {!error && !medicines?.length && (
          <div className="mt-8 rounded-3xl border border-dashed border-line bg-white p-10 text-center">
            <p className="font-display text-2xl font-semibold">
              No active medicines
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/55">
              Save a medicine from a scan or save a prescription to add
              medicines to your list.
            </p>
          </div>
        )}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(medicines ?? []).map((medicine) => {
            const { daysLeft, endDateLabel } = computeDaysRemaining(
              medicine.expiry_date,
              medicine.created_at,
              medicine.duration
            );

            const isExpired = daysLeft !== null && daysLeft < 0;
            const isExpiringSoon =
              daysLeft !== null && daysLeft >= 0 && daysLeft <= 2;

            const cardStyle = isExpired
              ? "border-2 border-red-400 bg-red-50/70"
              : isExpiringSoon
                ? "border-2 border-amber-400 bg-amber-50/80"
                : "border border-line bg-white";

            return (
              <article
                key={medicine.id}
                className={`rounded-2xl p-5 shadow-sm transition ${cardStyle}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p
                      className={`text-xs font-bold uppercase tracking-[.12em] ${
                        isExpired
                          ? "text-red-700"
                          : isExpiringSoon
                            ? "text-amber-700"
                            : "text-signal"
                      }`}
                    >
                      {isExpired
                        ? "Course Expired"
                        : isExpiringSoon
                          ? "Ending Soon"
                          : "Active"}
                    </p>
                    <h2 className="mt-1 text-lg font-bold">
                      {medicine.medicine_name}
                    </h2>
                  </div>

                  {isExpired ? (
                    <span className="shrink-0 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                      🚨 Expired
                    </span>
                  ) : isExpiringSoon ? (
                    <span className="shrink-0 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-amber-950">
                      ⚠️ Expiring Soon
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-[#E7F3F1] px-2.5 py-1 text-xs font-bold text-signal">
                      Active
                    </span>
                  )}
                </div>

                {isExpired && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-100/80 px-3 py-2 text-xs font-semibold text-red-900">
                    Duration ended{" "}
                    {endDateLabel ? `on ${endDateLabel}` : "recently"}. Consult
                    your doctor before continuing.
                  </div>
                )}

                {isExpiringSoon && (
                  <div className="mt-3 rounded-xl border border-amber-300 bg-amber-100/90 px-3 py-2 text-xs font-semibold text-amber-950">
                    ⚠️ Warning: Expiring soon (
                    {daysLeft === 0
                      ? "ends today"
                      : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
                    {endDateLabel ? ` · ${endDateLabel}` : ""}).
                  </div>
                )}

                {medicine.generic_name && (
                  <p className="mt-3 text-sm text-ink/70">
                    Composition: {medicine.generic_name}
                  </p>
                )}
                {medicine.strength && (
                  <p className="mt-1 text-sm text-ink/60">
                    Strength: {medicine.strength}
                  </p>
                )}
                {medicine.dosage_form && (
                  <p className="mt-1 text-sm text-ink/60">
                    Form: {medicine.dosage_form}
                  </p>
                )}
                {medicine.frequency && (
                  <p className="mt-1 text-sm text-ink/60">
                    Frequency: {medicine.frequency}
                  </p>
                )}
                {medicine.duration && (
                  <p className="mt-1 text-sm font-medium text-ink/75">
                    Duration: {medicine.duration}
                    {endDateLabel && !isExpired && !isExpiringSoon
                      ? ` (Ends ${endDateLabel})`
                      : ""}
                  </p>
                )}
                {medicine.instructions && (
                  <p className="mt-3 rounded-xl bg-white/80 p-3 text-xs leading-5 text-ink/65">
                    {medicine.instructions}
                  </p>
                )}

                <DeleteMedicineButton
                  medicineId={medicine.id}
                  medicineName={medicine.medicine_name}
                />
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}