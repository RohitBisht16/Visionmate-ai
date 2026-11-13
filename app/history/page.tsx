import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HistoryTimeline, {
  HistoryPrescriptionItem,
} from "@/components/HistoryTimeline";

export const metadata = { title: "Medical History · Visionmate AI" };

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 1. Fetch saved prescriptions + their grouped medicines
  const { data: rawPrescriptions } = await supabase
    .from("prescriptions")
    .select(
      `
      id,
      created_at,
      patient_name,
      status,
      image_path,
      prescription_medicines (
        id,
        medicine_name,
        strength,
        frequency,
        duration,
        instructions
      )
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // 2. Generate temporary signed URLs for private prescription images
  const prescriptions: HistoryPrescriptionItem[] = await Promise.all(
    (rawPrescriptions ?? []).map(async (rx: any) => {
      let signedUrl: string | null = null;
      if (rx.image_path) {
        const { data } = await supabase.storage
          .from("prescriptions")
          .createSignedUrl(rx.image_path, 3600);
        signedUrl = data?.signedUrl ?? null;
      }

      return {
        id: rx.id,
        created_at: rx.created_at,
        patient_name: rx.patient_name,
        status: rx.status,
        image_signed_url: signedUrl,
        medicines: Array.isArray(rx.prescription_medicines)
          ? rx.prescription_medicines
          : [],
      };
    })
  );

  // 3. Fetch all recorded user medicines (active + completed)
  const { data: medicines } = await supabase
    .from("user_medicines")
    .select(
      "id, medicine_name, generic_name, strength, frequency, duration, expiry_date, status, created_at"
    )
    .eq("user_id", user.id)
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
          <div className="flex gap-2">
            <Link
              href="/medicines"
              className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold"
            >
              My Medicines
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
            Medical timeline
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Scan &amp; medication history
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/60">
            Review your saved prescriptions, original scanned copies, and past
            medication courses in one place.
          </p>
        </section>

        <HistoryTimeline
          prescriptions={prescriptions}
          medicines={medicines ?? []}
        />
      </div>
    </main>
  );
}