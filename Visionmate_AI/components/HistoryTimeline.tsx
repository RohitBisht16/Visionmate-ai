"use client";

import { useState } from "react";
import Link from "next/link";

export type HistoryPrescriptionItem = {
  id: string;
  created_at: string;
  patient_name: string | null;
  status: string | null;
  image_signed_url: string | null;
  medicines: {
    id: string;
    medicine_name: string;
    strength: string | null;
    frequency: string | null;
    duration: string | null;
    instructions: string | null;
  }[];
};

export type HistoryMedicineItem = {
  id: string;
  medicine_name: string;
  generic_name: string | null;
  strength: string | null;
  frequency: string | null;
  duration: string | null;
  expiry_date: string | null;
  status: string | null;
  created_at: string;
};

type Props = {
  prescriptions: HistoryPrescriptionItem[];
  medicines: HistoryMedicineItem[];
};

function getMedicineCourseBadge(med: HistoryMedicineItem) {
  let targetDate: Date | null = null;

  if (med.expiry_date) {
    targetDate = new Date(med.expiry_date);
  } else if (med.duration && med.created_at) {
    const match = med.duration.match(
      /(\d+)\s*(day|days|d|week|weeks|wk|wks|month|months|mo|mos)\b/i
    );
    if (match) {
      const amount = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      targetDate = new Date(med.created_at);
      if (unit.startsWith("d")) targetDate.setDate(targetDate.getDate() + amount);
      else if (unit.startsWith("w"))
        targetDate.setDate(targetDate.getDate() + amount * 7);
      else if (unit.startsWith("m"))
        targetDate.setMonth(targetDate.getMonth() + amount);
    }
  }

  if (!targetDate || isNaN(targetDate.getTime())) {
    return { label: "Recorded", style: "bg-[#E7F3F1] text-signal" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(targetDate);
  end.setHours(0, 0, 0, 0);
  const daysLeft = Math.round(
    (end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysLeft < 0) {
    return { label: "Completed / Expired", style: "bg-red-100 text-red-800" };
  }
  if (daysLeft <= 2) {
    return { label: "Expiring Soon", style: "bg-amber-100 text-amber-900" };
  }
  return { label: "Active", style: "bg-[#E7F3F1] text-signal" };
}

export default function HistoryTimeline({ prescriptions, medicines }: Props) {
  const [tab, setTab] = useState<"all" | "prescriptions" | "medicines">("all");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const showPrescriptions = tab === "all" || tab === "prescriptions";
  const showMedicines = tab === "all" || tab === "medicines";

  return (
    <>
      {/* Filter Pills */}
      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["all", `All Activity (${prescriptions.length + medicines.length})`],
            ["prescriptions", `Prescriptions (${prescriptions.length})`],
            ["medicines", `Medicines (${medicines.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              tab === key
                ? "bg-signal text-white shadow-sm"
                : "border border-line bg-white text-ink/70 hover:bg-[#F5F8F7]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {prescriptions.length === 0 && medicines.length === 0 && (
        <div className="mt-8 rounded-3xl border border-dashed border-line bg-white p-10 text-center">
          <p className="font-display text-2xl font-semibold">No history yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/55">
            Scan a prescription or medicine to start building your permanent
            medical timeline.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/prescription/scan"
              className="rounded-xl bg-signal px-5 py-3 text-sm font-bold text-white"
            >
              Scan Prescription
            </Link>
            <Link
              href="/scan"
              className="rounded-xl border border-line bg-white px-5 py-3 text-sm font-bold text-ink"
            >
              Scan Medicine
            </Link>
          </div>
        </div>
      )}

      {/* Scanned Prescriptions Section */}
      {showPrescriptions && prescriptions.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-2xl font-semibold">
            Scanned Prescriptions
          </h2>
          <div className="mt-4 space-y-4">
            {prescriptions.map((rx) => (
              <article
                key={rx.id}
                className="rounded-2xl border border-line bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.14em] text-signal">
                      {new Date(rx.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                    <h3 className="mt-1 text-lg font-bold">
                      {rx.patient_name
                        ? `Patient: ${rx.patient_name}`
                        : "Verified Prescription"}
                    </h3>
                  </div>

                  {rx.image_signed_url && (
                    <button
                      type="button"
                      onClick={() => setPreviewUrl(rx.image_signed_url)}
                      className="rounded-xl border border-line bg-[#F5F8F7] px-4 py-2 text-xs font-bold text-ink hover:bg-[#E7F3F1]"
                    >
                      View Original Image
                    </button>
                  )}
                </div>

                {rx.medicines.length > 0 ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {rx.medicines.map((med) => (
                      <div
                        key={med.id}
                        className="rounded-xl bg-[#F5F8F7] p-3.5 text-sm"
                      >
                        <p className="font-bold text-ink">{med.medicine_name}</p>
                        <p className="mt-1 text-xs text-ink/65">
                          {[med.strength, med.frequency, med.duration]
                            .filter(Boolean)
                            .join(" • ") || "Dosage details recorded"}
                        </p>
                        {med.instructions && (
                          <p className="mt-1 text-xs text-ink/50">
                            {med.instructions}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-ink/50">
                    No itemized medicines linked to this scan.
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Medication Timeline Section */}
      {showMedicines && medicines.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">
            Medication Log
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {medicines.map((med) => {
              const badge = getMedicineCourseBadge(med);
              return (
                <article
                  key={med.id}
                  className="rounded-2xl border border-line bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-ink/50">
                        Added{" "}
                        {new Date(med.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                      <h3 className="mt-1 text-base font-bold">
                        {med.medicine_name}
                      </h3>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${badge.style}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  {med.generic_name && (
                    <p className="mt-2 text-xs text-ink/65">
                      Composition: {med.generic_name}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-ink/60">
                    {[med.strength, med.frequency, med.duration]
                      .filter(Boolean)
                      .join(" • ") || "No schedule specified"}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Prescription Image Lightbox Modal */}
      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-3xl overflow-auto rounded-2xl bg-white p-4 shadow-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold">Saved Prescription Image</p>
              <button
                type="button"
                onClick={() => setPreviewUrl(null)}
                className="rounded-lg border border-line px-3 py-1 text-xs font-bold"
              >
                Close ✕
              </button>
            </div>
            <img
              src={previewUrl}
              alt="Saved prescription"
              className="max-h-[75vh] w-auto rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}