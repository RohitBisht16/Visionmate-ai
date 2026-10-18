import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AIChatBox from "@/components/ai-chatbox";
export const metadata = { title: "Ask Visionmate · Visionmate AI" };
export default async function AskPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <main className="min-h-screen bg-[#F5F8F7] px-4 py-6 text-ink sm:px-6 lg:px-10"><div className="mx-auto max-w-5xl"><header className="flex items-center justify-between"><Link href="/dashboard" className="font-display text-2xl font-semibold">Visionmate AI</Link><Link href="/dashboard" className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold">Dashboard</Link></header><div className="mt-8"><AIChatBox /></div></div></main>;
}
