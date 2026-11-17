"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Prescription = {
  id: string;
  user_id: string;
  raw_ocr_text: string;
  ocr_confidence: number | null;
  status: string;
  image_path: string | null;
  patient_name?: string | null;
  created_at: string;
};

type PrescriptionMedicine = {
  id: string;
  prescription_id: string;
  medicine_name: string;
  strength: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
};

function getPatientName(text: string) {
  const match = text.match(
    /patient\s*name\s*[:\-]\s*([A-Za-z][A-Za-z .'-]{2,})(?=\s+(?:age|sex|gender|mrn|date)\b|$)/i
  );
  return match?.[1]?.trim() || "Patient name not detected";
}

export default function PrescriptionsPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Prescription[]>([]);
  const [medicines, setMedicines] = useState<Record<string, PrescriptionMedicine[]>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        window.location.href = "/login";
        return;
      }

      const { data, error: prescriptionError } = await supabase
        .from("prescriptions")
        .select("id,user_id,raw_ocr_text,ocr_confidence,status,image_path,patient_name,created_at")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false });

      if (prescriptionError) {
        // Backward-compatible fallback if patient_name has not been added to the table yet.
        const fallback = await supabase
          .from("prescriptions")
          .select("id,user_id,raw_ocr_text,ocr_confidence,status,image_path,created_at")
          .eq("user_id", auth.user.id)
          .order("created_at", { ascending: false });

        if (fallback.error) {
          if (active) setError(fallback.error.message);
          setLoading(false);
          return;
        }
        if (active) setItems((fallback.data ?? []) as Prescription[]);
      } else if (active) {
        setItems((data ?? []) as Prescription[]);
      }

      setLoading(false);
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  async function openPrescription(item: Prescription) {
    if (openId === item.id) {
      setOpenId(null);
      return;
    }

    setOpenId(item.id);

    if (!medicines[item.id]) {
      const { data } = await supabase
        .from("prescription_medicines")
        .select("id,prescription_id,medicine_name,strength,frequency,duration,instructions")
        .eq("prescription_id", item.id)
        .order("created_at", { ascending: true });

      setMedicines((current) => ({ ...current, [item.id]: data ?? [] }));
    }

    if (item.image_path && !imageUrls[item.id]) {
      const { data } = await supabase.storage
        .from("prescriptions")
        .createSignedUrl(item.image_path, 300);

      if (data?.signedUrl) {
        setImageUrls((current) => ({ ...current, [item.id]: data.signedUrl }));
      }
    }
  }

  return (
    <main className="min-h-screen bg-[#F5F8F7] px-4 py-8 text-ink sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-signal">
              Prescription history
            </p>
            <h1 className="mt-1 font-display text-4xl font-semibold">My prescriptions</h1>
            <p className="mt-2 text-sm text-ink/60">
              Every saved prescription is kept as one record. Open a card to see its medicines and original image.
            </p>
          </div>
          <Link
            href="/prescription"
            className="rounded-xl bg-signal px-4 py-3 text-sm font-bold text-white"
          >
            Scan prescription
          </Link>
        </header>

        {loading && (
          <div className="mt-8 rounded-2xl border border-line bg-white p-6 text-sm">
            Loading your prescriptions...
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
            {error}
          </div>
        )}

        {!loading && !items.length && !error && (
          <div className="mt-8 rounded-3xl border border-dashed border-line bg-white p-10 text-center">
            <h2 className="font-display text-2xl font-semibold">No prescriptions yet</h2>
            <p className="mt-2 text-sm text-ink/60">
              Scan or upload a prescription to create your first prescription record.
            </p>
            <Link
              href="/prescription"
              className="mt-5 inline-flex rounded-xl bg-signal px-5 py-3 text-sm font-bold text-white"
            >
              Scan a prescription
            </Link>
          </div>
        )}

        <div className="mt-8 grid gap-5">
          {items.map((item) => {
            const patient =
              item.patient_name?.trim() || getPatientName(item.raw_ocr_text);
            const date = new Date(item.created_at).toLocaleDateString();
            const open = openId === item.id;
            const meds = medicines[item.id] ?? [];

            return (
              <article
                key={item.id}
                className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => openPrescription(item)}
                  className="w-full p-5 text-left transition hover:bg-[#F8FBFA]"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[.14em] text-signal">
                        Prescription
                      </p>
                      <h2 className="mt-1 text-xl font-semibold">
                        {patient}
                      </h2>
                      <p className="mt-1 text-sm text-ink/55">
                        Scanned on {date}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-[#E7F3F1] px-3 py-1 text-xs font-bold text-signal">
                        {item.status === "verified" ? "Verified" : "Needs review"}
                      </span>
                      <span className="text-xl text-signal">{open ? "−" : "+"}</span>
                    </div>
                  </div>
                </button>

                {open && (
                  <div className="border-t border-line bg-[#FBFCFC] p-5">
                    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
                      <div>
                        {imageUrls[item.id] ? (
                          <img
                            src={imageUrls[item.id]}
                            alt={`Prescription for ${patient}`}
                            className="max-h-[380px] w-full rounded-2xl border border-line object-contain bg-white"
                          />
                        ) : (
                          <div className="grid min-h-[220px] place-items-center rounded-2xl border border-dashed border-line bg-white p-5 text-center text-sm text-ink/50">
                            Original prescription image unavailable.
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[.14em] text-signal">
                              Medicines in this prescription
                            </p>
                            <h3 className="mt-1 font-display text-2xl font-semibold">
                              {meds.length} medicine{meds.length === 1 ? "" : "s"}
                            </h3>
                          </div>
                        </div>

                        {!meds.length ? (
                          <p className="mt-5 rounded-2xl border border-line bg-white p-4 text-sm text-ink/55">
                            No prescription medicines were saved for this record.
                          </p>
                        ) : (
                          <div className="mt-4 grid gap-3">
                            {meds.map((med) => (
                              <div
                                key={med.id}
                                className="rounded-2xl border border-line bg-white p-4"
                              >
                                <h4 className="font-semibold">{med.medicine_name}</h4>
                                <div className="mt-2 grid gap-2 text-sm text-ink/65 sm:grid-cols-2">
                                  {med.strength && <p><b>Strength:</b> {med.strength}</p>}
                                  {med.frequency && <p><b>Frequency:</b> {med.frequency}</p>}
                                  {med.duration && <p><b>Duration:</b> {med.duration}</p>}
                                  {med.instructions && (
                                    <p className="sm:col-span-2">
                                      <b>Other information:</b> {med.instructions}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
