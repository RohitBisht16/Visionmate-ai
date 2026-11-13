"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type UserProfileData = {
  full_name: string;
  age: string;
  blood_group: string;
  phone: string;
  allergies: string;
  chronic_conditions: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  doctor_name: string;
  doctor_phone: string;
};

type Props = {
  email: string;
  initialData: UserProfileData;
};

export default function ProfileForm({ email, initialData }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState<UserProfileData>(initialData);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function updateField(field: keyof UserProfileData, value: string) {
    setSaved(false);
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSaved(false);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: form.full_name.trim(),
          age: form.age.trim(),
          blood_group: form.blood_group.trim(),
          phone: form.phone.trim(),
          allergies: form.allergies.trim(),
          chronic_conditions: form.chronic_conditions.trim(),
          emergency_contact_name: form.emergency_contact_name.trim(),
          emergency_contact_phone: form.emergency_contact_phone.trim(),
          doctor_name: form.doctor_name.trim(),
          doctor_phone: form.doctor_phone.trim(),
        },
      });

      if (updateError) throw updateError;

      setSaved(true);
      router.refresh();
    } catch (err: any) {
      console.error("Profile update error:", err);
      setError(err?.message || "Could not save profile. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="mt-8 space-y-6">
      {/* Emergency Medical Summary Banner */}
      {(form.blood_group || form.allergies || form.emergency_contact_phone) && (
        <div className="rounded-3xl border-2 border-[#D4E6E2] bg-[#EAF5F2] p-5">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-signal">
            Quick Emergency Medical Card
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <span className="text-xs text-ink/55">Blood Group</span>
              <p className="text-lg font-bold text-ink">
                {form.blood_group || "Not set"}
              </p>
            </div>
            <div>
              <span className="text-xs text-ink/55">Known Allergies</span>
              <p className="text-sm font-bold text-red-700">
                {form.allergies || "None listed"}
              </p>
            </div>
            <div>
              <span className="text-xs text-ink/55">Emergency Contact</span>
              <p className="text-sm font-bold text-ink">
                {form.emergency_contact_name || "Caregiver"}{" "}
                {form.emergency_contact_phone
                  ? `• ${form.emergency_contact_phone}`
                  : ""}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {error}
        </div>
      )}

      {saved && (
        <div className="rounded-2xl border border-[#D4E6E2] bg-[#E7F3F1] p-4 text-sm font-semibold text-signal">
          Profile and medical ID saved successfully.
        </div>
      )}

      {/* Section 1: Personal Details */}
      <div className="rounded-3xl border border-line bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-signal">
          Personal details
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          Basic information
        </h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label>
            <span className="text-xs font-semibold text-ink/60">Full Name</span>
            <input
              type="text"
              value={form.full_name}
              onChange={(e) => updateField("full_name", e.target.value)}
              placeholder="e.g. Ramesh Chandra Sharma"
              className="mt-1 w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-signal"
            />
          </label>

          <div>
            <span className="text-xs font-semibold text-ink/60">
              Account Email
            </span>
            <p className="mt-1 rounded-xl border border-line bg-[#F5F8F7] px-3.5 py-2.5 text-sm text-ink/65">
              {email}
            </p>
          </div>

          <label>
            <span className="text-xs font-semibold text-ink/60">Age</span>
            <input
              type="text"
              value={form.age}
              onChange={(e) => updateField("age", e.target.value)}
              placeholder="e.g. 68"
              className="mt-1 w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-signal"
            />
          </label>

          <label>
            <span className="text-xs font-semibold text-ink/60">
              Blood Group
            </span>
            <select
              value={form.blood_group}
              onChange={(e) => updateField("blood_group", e.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none focus:border-signal"
            >
              <option value="">Select blood group</option>
              {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
          </label>

          <label className="sm:col-span-2">
            <span className="text-xs font-semibold text-ink/60">
              Personal Phone Number
            </span>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className="mt-1 w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-signal"
            />
          </label>
        </div>
      </div>

      {/* Section 2: Health & Allergy Safety */}
      <div className="rounded-3xl border border-line bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-signal">
          Safety profile
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          Allergies &amp; medical conditions
        </h2>

        <div className="mt-5 grid gap-4">
          <label>
            <span className="text-xs font-semibold text-ink/60">
              Medicine or Food Allergies
            </span>
            <input
              type="text"
              value={form.allergies}
              onChange={(e) => updateField("allergies", e.target.value)}
              placeholder="e.g. Penicillin, Sulfa drugs, Peanuts (or None)"
              className="mt-1 w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-signal"
            />
          </label>

          <label>
            <span className="text-xs font-semibold text-ink/60">
              Existing Conditions
            </span>
            <textarea
              rows={3}
              value={form.chronic_conditions}
              onChange={(e) =>
                updateField("chronic_conditions", e.target.value)
              }
              placeholder="e.g. Hypertension, Type 2 Diabetes, Arthritis"
              className="mt-1 w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-signal"
            />
          </label>
        </div>
      </div>

      {/* Section 3: Caregiver & Primary Doctor */}
      <div className="rounded-3xl border border-line bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-signal">
          Care network
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold">
          Emergency contact &amp; primary doctor
        </h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label>
            <span className="text-xs font-semibold text-ink/60">
              Family / Caregiver Name
            </span>
            <input
              type="text"
              value={form.emergency_contact_name}
              onChange={(e) =>
                updateField("emergency_contact_name", e.target.value)
              }
              placeholder="e.g. Ankit Sharma (Son)"
              className="mt-1 w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-signal"
            />
          </label>

          <label>
            <span className="text-xs font-semibold text-ink/60">
              Emergency Phone Number
            </span>
            <input
              type="tel"
              value={form.emergency_contact_phone}
              onChange={(e) =>
                updateField("emergency_contact_phone", e.target.value)
              }
              placeholder="e.g. +91 98111 22334"
              className="mt-1 w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-signal"
            />
          </label>

          <label>
            <span className="text-xs font-semibold text-ink/60">
              Primary Doctor Name
            </span>
            <input
              type="text"
              value={form.doctor_name}
              onChange={(e) => updateField("doctor_name", e.target.value)}
              placeholder="e.g. Dr. A. K. Verma"
              className="mt-1 w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-signal"
            />
          </label>

          <label>
            <span className="text-xs font-semibold text-ink/60">
              Doctor / Clinic Phone
            </span>
            <input
              type="tel"
              value={form.doctor_phone}
              onChange={(e) => updateField("doctor_phone", e.target.value)}
              placeholder="e.g. +91 120 2456789"
              className="mt-1 w-full rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none focus:border-signal"
            />
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-signal px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50"
      >
        {busy ? "Saving profile..." : "Save Profile & Medical ID"}
      </button>
    </form>
  );
}