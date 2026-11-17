/** Decorative blister-pack motif. Purely visual. */
export function BlisterStrip() {
  return (
    <div aria-hidden="true" className="grid w-fit grid-cols-6 gap-2.5 rounded-2xl border border-white/10 bg-white/[.04] p-3.5 shadow-inner">
      {Array.from({ length: 12 }).map((_, i) => (
        <span key={i} className={`h-8 w-8 rounded-full border ${i === 4 ? "border-[#8DE0D6] bg-[#8DE0D6]/80 shadow-[0_0_18px_rgba(141,224,214,.25)]" : "border-white/15 bg-white/[.04]"}`} />
      ))}
    </div>
  );
}
