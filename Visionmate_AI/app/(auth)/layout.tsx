import Link from "next/link";
import { BlisterStrip } from "@/components/BlisterStrip";

function LogoMark() {
  return <span className="grid h-10 w-10 place-items-center rounded-[13px] bg-white text-signal shadow-sm ring-1 ring-black/5"><svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="8.5"/></svg></span>;
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F8F7] lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(520px,.92fr)]">
      <aside className="relative hidden min-h-screen overflow-hidden bg-[#092F31] text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-50 auth-grid" />
        <div className="absolute -right-24 top-16 h-72 w-72 rounded-full border border-white/10" />
        <div className="absolute -right-10 top-30 h-56 w-56 rounded-full border border-white/10" />
        <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
          <Link href="/" className="flex items-center gap-3 w-fit">
            <LogoMark /><span className="font-display text-[25px] font-semibold tracking-tight">Visionmate AI</span>
          </Link>

          <div className="max-w-xl">
            <div className="mb-8 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.18em] text-[#A8DCD7]"><span className="h-2 w-2 rounded-full bg-[#69D4C7]" /> Intelligent medicine awareness</div>
            <h2 className="font-display text-5xl font-medium leading-[1.04] xl:text-6xl">A clearer view of every medicine you take.</h2>
            <p className="mt-6 max-w-lg text-[16px] leading-7 text-white/65">Scan, organize and understand medication information in one private workspace designed to keep important details easier to see.</p>

            <div className="mt-10 grid max-w-lg grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[.06] p-4 backdrop-blur"><div className="text-2xl font-semibold">01</div><div className="mt-1 text-sm text-white/55">Capture medicine details</div></div>
              <div className="rounded-2xl border border-white/10 bg-white/[.06] p-4 backdrop-blur"><div className="text-2xl font-semibold">02</div><div className="mt-1 text-sm text-white/55">Keep your list organized</div></div>
            </div>
          </div>

          <div className="flex items-end justify-between gap-8">
            <div><BlisterStrip /><p className="mt-4 max-w-md text-xs leading-5 text-white/45">Information and safety flags are for awareness only and do not replace a qualified healthcare professional.</p></div>
            <div className="hidden xl:block text-right text-xs text-white/40">Private workspace<br/>Built for clarity</div>
          </div>
        </div>
      </aside>

      <main className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-10">
        <div className="w-full max-w-[460px]">
          <Link href="/" className="mb-8 flex w-fit items-center gap-2.5 lg:hidden"><LogoMark /><span className="font-display text-2xl font-semibold">Visionmate AI</span></Link>
          <div className="rounded-[28px] border border-[#DCE5E3] bg-white p-6 shadow-[0_24px_70px_rgba(15,42,46,.08)] sm:p-9">
            {children}
          </div>
          <p className="mt-5 text-center text-[11px] leading-5 text-ink/45">Your account data is protected by your authentication provider. Visionmate AI does not diagnose or prescribe.</p>
        </div>
      </main>
    </div>
  );
}
