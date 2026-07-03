import { redirect } from "next/navigation";

/** Legacy URL — absence workflow moved to ERA Workspace (CP). */
export default function LegacyNewAbsenceRedirectPage() {
  redirect("/payroll");
}
