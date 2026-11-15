import { redirect } from "next/navigation";

// /prescription has no screen of its own; send visitors to the scanner.
export default function PrescriptionPage() {
  redirect("/prescription/scan");
}
