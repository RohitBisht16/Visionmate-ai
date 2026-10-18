import HealthCenterMap from "@/components/health-center-map";

export default function SafetyPage() {
  return (
    <main className="min-h-screen bg-[#f5fbfa] px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-700">
            Safety Center
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">
            Find nearby health care
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Use your current location to find nearby hospitals, medical
            clinics, doctors, and pharmacies on a live Google map.
          </p>
        </div>

        <HealthCenterMap radiusMeters={5000} />

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          <strong className="text-slate-900">Safety note:</strong> Visionmate
          provides informational assistance. In an emergency or severe
          symptoms, contact local emergency services or a qualified healthcare
          professional.
        </div>
      </div>
    </main>
  );
}
