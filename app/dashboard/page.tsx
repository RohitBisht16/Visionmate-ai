import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Visionmate AI · Dashboard" };

const nav = [
  { label: "Overview", href: "/dashboard", icon: "▣" },
  { label: "Prescription", href: "/prescriptions", icon: "▤" },
  { label: "My medicines", href: "/medicines", icon: "◉" },
  { label: "Safety Center", href: "/safety", icon: "♡" },
  { label: "Ask Visionmate", href: "/ask", icon: "✦" },
   { label: "Voice Assistant", href: "/voice-assistant", icon: "🎙️" },
  { label: "History", href: "/history", icon: "◷" },
];

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { count: medicineCount }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("user_medicines")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
  ]);

  const name = profile?.full_name?.trim() || user.email?.split("@")[0] || "there";
  const firstName = name.split(" ")[0];

  return (
    <div className="min-h-screen bg-white text-[#102F3B]">
      {/* Header */}
      <header className="sticky top-0 z-40 h-[66px] border-b border-[#E6ECEE] bg-white">
        <div className="flex h-full items-center px-5 sm:px-7">
          <div className="w-[245px] shrink-0">
            <Link href="/dashboard" className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#079B98] text-2xl font-light text-white">+</span>
              <span className="font-display text-[24px] font-semibold tracking-tight text-[#102F3B]">Visionmate AI</span>
            </Link>
          </div>

          <div className="hidden max-w-[545px] flex-1 md:block">
            <div className="ml-7 flex h-10 items-center gap-3 rounded-full border border-[#DCE5E8] bg-[#F7FAFB] px-4 text-sm text-[#71858B]">
              <span className="text-xl leading-none">⌕</span>
              <span>Search your medicines, ask Visionmate...</span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-5">
            <span className="relative hidden text-xl text-[#173A46] sm:block">♧
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#EF3340]" />
            </span>
            <Link href="/profile" className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#DDF4F2] font-bold text-[#078F8C]">
                {firstName.charAt(0).toUpperCase()}
              </span>
              <span className="hidden max-w-[155px] truncate text-sm font-semibold text-[#173A46] sm:block">{name}</span>
              <span className="text-xs">⌄</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="sticky top-[66px] hidden h-[calc(100vh-66px)] w-[273px] shrink-0 border-r border-[#E6ECEE] bg-white lg:block">
          <div className="flex h-full flex-col px-[18px] py-8">
            <p className="mb-4 px-5 text-[11px] font-bold uppercase tracking-[.16em] text-[#8FA1A7]">Workspace</p>

            <nav className="space-y-1">
              {nav.map((item, i) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-5 rounded-2xl px-5 py-3.5 text-[15px] ${
                    i === 0
                      ? "bg-[#E4F6F4] font-semibold text-[#078F8C]"
                      : "font-medium text-[#425F67] hover:bg-[#F3F8F8] hover:text-[#078F8C]"
                  }`}
                >
                  <span className="w-5 text-center text-[21px]">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="my-7 h-px bg-[#E6ECEE]" />

            <nav className="space-y-1">
              <Link href="/profile" className="flex items-center gap-5 rounded-2xl px-5 py-3.5 text-[15px] font-medium text-[#425F67] hover:bg-[#F3F8F8]">♙ <span>Profile</span></Link>
              <Link href="/settings" className="flex items-center gap-5 rounded-2xl px-5 py-3.5 text-[15px] font-medium text-[#425F67] hover:bg-[#F3F8F8]">⚙ <span>Settings</span></Link>
            </nav>

            <div className="mt-auto">
              <form action="/auth/signout" method="post">
                <button className="flex w-full items-center gap-5 rounded-2xl border border-[#E2EAEC] bg-white px-5 py-3.5 text-[15px] font-semibold text-[#405C64] shadow-sm hover:bg-[#F6FAFA]">
                  ↪ <span>Log out</span>
                </button>
              </form>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {/* Hero - closely matched to supplied reference */}
          <section className="relative overflow-hidden bg-[#F1FAF9]">
            <div className="absolute inset-0 bg-gradient-to-r from-[#F2FBFA] via-[#F5FCFC]/95 to-[#E0F4F2]/60" />

            <div className="relative mx-auto grid min-h-[530px] max-w-[1260px] grid-cols-1 items-center lg:grid-cols-[.94fr_1.06fr]">
              <div className="relative z-10 px-8 py-12 sm:px-12 lg:px-10 xl:px-12">
                <div className="inline-flex rounded-full border border-[#B9E3DF] bg-white/80 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.16em] text-[#078F8C]">
                  Your medication companion
                </div>

                <h1 className="mt-5 max-w-[620px] font-display text-[50px] font-semibold leading-[.98] tracking-[-.035em] text-[#102F3B] sm:text-[61px]">
                  Understand your<br />
                  medicines with<br />
                  <span className="text-[#079B98]">confidence.</span>
                </h1>

                <p className="mt-6 max-w-[610px] text-[16px] leading-7 text-[#5E7880]">
                  Scan medicines, understand prescriptions, keep your medication
                  information organized, and stay safe with AI-powered insights.
                </p>

                <div className="mt-8 flex flex-wrap gap-4">
                  <Link href="/scan" className="inline-flex h-[62px] items-center gap-4 rounded-2xl bg-[#079B98] px-7 text-[15px] font-bold text-white shadow-[0_12px_28px_rgba(7,155,152,.20)] hover:bg-[#078C89]">
                    <span className="text-2xl">⌗</span>
                    Scan Medicine
                    <span className="text-xl">→</span>
                  </Link>
                  <Link href="/prescription/scan" className="inline-flex h-[62px] items-center gap-4 rounded-2xl border border-[#D7E2E4] bg-white px-7 text-[15px] font-bold text-[#173A46] shadow-sm hover:border-[#A9D3D0]">
                    <span className="text-xl">▤</span>
                    Scan Prescription
                    <span className="text-xl">→</span>
                  </Link>
                </div>

                <div className="mt-7 flex flex-wrap gap-7 text-[12px] font-medium text-[#607980]">
                  <span><b className="mr-2 text-[#12B5AC]">✓</b>Accurate information</span>
                  <span><b className="mr-2 text-[#12B5AC]">✓</b>AI-powered insights</span>
                  <span><b className="mr-2 text-[#12B5AC]">✓</b>Your personal workspace</span>
                </div>
              </div>

              <div className="relative h-full min-h-[530px] overflow-hidden">
                <img
                  src="/visionmate-hero-reference.jpg"
                  alt="Visionmate medicine scanning visual"
                  className="absolute inset-0 h-full w-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#F1FAF9] via-transparent to-transparent lg:w-1/3" />
              </div>
            </div>
          </section>

          {/* How it works - no stat boxes, matching reference */}
          <section className="relative overflow-hidden bg-white">
            <div className="absolute right-[-130px] top-[-90px] h-[470px] w-[470px] rounded-full border-[60px] border-[#E7F7F5]" />
            <div className="relative mx-auto max-w-[1260px] px-8 py-9 sm:px-12 lg:px-10 xl:px-12">
              <h2 className="font-display text-[32px] font-semibold tracking-tight text-[#102F3B] sm:text-[38px]">
                How Visionmate Works
              </h2>
              <p className="mt-1 text-[15px] text-[#6B8289]">
                A simple and powerful way to manage your medicines.
              </p>

              <div className="mt-9 grid grid-cols-1 gap-7 md:grid-cols-5">
                {[
                  ["1.", "⌾", "Scan", "Scan a medicine or upload a prescription.", "teal"],
                  ["2.", "▤", "Understand", "Get clear, verified information with AI.", "blue"],
                  ["3.", "◉", "Organize", "Keep your medicines in one place.", "orange"],
                  ["4.", "♡", "Stay Safe", "Check for interactions and safety issues.", "purple"],
                  ["5.", "✦", "Ask Visionmate", "Get answers to your medication questions.", "teal"],
                ].map(([num, icon, title, desc, tone], index) => (
                  <div key={title} className="relative text-center">
                    {index < 4 && <div className="absolute right-[-18px] top-[42px] hidden text-3xl text-[#079B98] md:block">→</div>}
                    <div className={`mx-auto grid h-[86px] w-[86px] place-items-center rounded-full text-[31px] ${
                      tone === "blue" ? "bg-[#EAF1FF] text-[#4D86E8]" :
                      tone === "orange" ? "bg-[#FFF0E1] text-[#F28A1A]" :
                      tone === "purple" ? "bg-[#F0E8FF] text-[#8061D8]" :
                      "bg-[#E3F7F5] text-[#079B98]"
                    }`}>
                      {icon}
                    </div>
                    <div className="mt-5 text-[14px] font-bold text-[#078F8C]">{num} {title}</div>
                    <p className="mx-auto mt-2 max-w-[190px] text-[14px] leading-5 text-[#71868D]">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <footer className="border-t border-[#E6ECEE] bg-white px-8 py-6">
            <div className="mx-auto flex max-w-[1260px] justify-between text-xs text-[#84959A]">
              <span>© {new Date().getFullYear()} Visionmate AI</span>
              <span>Informational assistance — not diagnosis or prescribing.</span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
