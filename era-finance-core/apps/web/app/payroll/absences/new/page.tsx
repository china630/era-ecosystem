import { redirect } from "next/navigation";

/** Legacy URL — absence workflow moved to ERA Workspace (CP). */
export default function LegacyNewAbsenceRedirectPage() {
  const orch =
    process.env.NEXT_PUBLIC_ORCH_WEB_URL?.replace(/\/$/, "") ??
    "http://127.0.0.1:3000";
  redirect(`${orch}/workspace/workforce/absences/new`);
}
