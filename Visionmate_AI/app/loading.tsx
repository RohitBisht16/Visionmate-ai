export default function Loading() {
  return (
    <div className="p-6 space-y-4 animate-pulse max-w-5xl mx-auto">
      <div className="h-7 w-48 bg-zinc-200 rounded-md" />
      <div className="h-4 w-72 bg-zinc-100 rounded-md" />
      <div className="grid gap-4 sm:grid-cols-2 pt-2">
        <div className="h-36 bg-zinc-100 rounded-xl border border-zinc-200" />
        <div className="h-36 bg-zinc-100 rounded-xl border border-zinc-200" />
      </div>
    </div>
  );
}