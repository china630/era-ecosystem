import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  authCookieName,
  financeWebUrl,
  hasPlatformCapability,
  verifySatelliteSession,
} from "@era/satellite-kit";
import { PageHeader, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import FbPosNav from "@/components/FbPosNav";

export default async function ExecutivePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(authCookieName())?.value;
  if (!token) redirect("/login");

  let session;
  try {
    session = await verifySatelliteSession(token);
  } catch {
    redirect("/login");
  }

  const canView = hasPlatformCapability(session, "canViewExecutive");
  const financeUrl = financeWebUrl();

  return (
    <>
      <FbPosNav />
      <PageHeader
        title="Executive summary"
        subtitle="F&B — owner view (billing in Finance / Orchestrator)"
      />
      {!canView ? (
        <p className="mt-4 text-sm text-red-600">
          Restricted to platform roles (OWNER/DIRECTOR/ADMIN/ACCOUNTANT via Orch SSO).
        </p>
      ) : (
        <div className="mt-6 space-y-3 rounded-lg border border-[#D5DADF] bg-white p-4 text-sm">
          <p>Organization: {session.organizationId ?? "—"}</p>
          <p>Finance role: {session.financeRole ?? session.role}</p>
          {financeUrl ? (
            <Link href={`${financeUrl.replace(/\/$/, "")}/home`} className={SECONDARY_BUTTON_CLASS}>
              Open Finance →
            </Link>
          ) : null}
        </div>
      )}
    </>
  );
}
