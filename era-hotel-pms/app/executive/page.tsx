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
    <main className="mx-auto max-w-3xl p-6">
      <PageHeader
        title="Executive summary"
        subtitle="Hotel PMS — owner KPIs; GL and holding in Finance only"
      />
      {!canView ? (
        <p className="mt-4 text-sm text-red-600">
          Restricted to platform roles (OWNER/DIRECTOR/ADMIN/ACCOUNTANT via Orch SSO).
        </p>
      ) : (
        <div className="mt-6 space-y-3 rounded-lg border border-[#D5DADF] bg-white p-4 text-sm">
          <p>Organization: {session.organizationId ?? "—"}</p>
          <p>Finance role: {session.financeRole ?? session.role}</p>
          <p className="text-[#7F8C8D]">
            Operational metrics: use Night audit, folio reports, and channel dashboards.
          </p>
          {financeUrl ? (
            <Link href={`${financeUrl.replace(/\/$/, "")}/home`} className={SECONDARY_BUTTON_CLASS}>
              Open Finance →
            </Link>
          ) : null}
        </div>
      )}
    </main>
  );
}
