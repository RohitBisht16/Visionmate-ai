import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/utils";

export default async function Home() {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) redirect("/dashboard");
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <h1 className="font-display text-5xl">Visionmate AI</h1>
      <p className="mt-4 font-display text-2xl">A second pair of eyes for every medicine you take.</p>
      <div className="mt-10 flex flex-wrap gap-4">
        <Link href="/signup" className="rounded-md bg-signal px-6 py-3 font-semibold text-white hover:bg-signal-dark">
          Create account
        </Link>
        <Link href="/login" className="rounded-md border border-ink px-6 py-3 font-semibold">Log in</Link>
      </div>
    </main>
  );
}
