"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Props = {
  medicineId: string;
  medicineName: string;
};

async function verifyFingerprint(medicineName: string): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    !window.PublicKeyCredential ||
    !navigator.credentials
  ) {
    return window.confirm(
      `Fingerprint sensor not available on this browser. Confirm removing "${medicineName}"?`
    );
  }

  try {
    const available =
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();

    if (!available) {
      return window.confirm(
        `No fingerprint/biometric sensor detected on this device. Confirm removing "${medicineName}"?`
      );
    }

    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));

    // Triggers native Windows Hello / Touch ID / Android Fingerprint prompt
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: "Visionmate AI",
          id: window.location.hostname,
        },
        user: {
          id: userId,
          name: "visionmate-user",
          displayName: "Visionmate User",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256
          { type: "public-key", alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
        timeout: 60000,
        attestation: "none",
      },
    });

    return Boolean(credential);
  } catch (err: any) {
    // User cancelled fingerprint scan or timed out
    console.warn("Fingerprint verification cancelled/failed:", err);
    return false;
  }
}

export default function DeleteMedicineButton({
  medicineId,
  medicineName,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (busy) return;
    setBusy(true);

    try {
      const verified = await verifyFingerprint(medicineName);
      if (!verified) {
        setBusy(false);
        return;
      }

      const { error } = await supabase
        .from("user_medicines")
        .delete()
        .eq("id", medicineId);

      if (error) {
        alert("Could not delete medicine. Please try again.");
        console.error("Delete medicine error:", error);
        return;
      }

      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={busy}
      title="Verify fingerprint to delete medicine"
      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2.5 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
    >
      <span>🫆</span>
      <span>{busy ? "Verifying fingerprint..." : "Delete (Fingerprint)"}</span>
    </button>
  );
}