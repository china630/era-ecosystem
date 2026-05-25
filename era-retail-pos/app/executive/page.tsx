import { PageHeader } from "@era/satellite-kit/ui";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  authCookieName,
  SATELLITE_ROLE,
  verifySatelliteSession,
} from "@era/satellite-kit";

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

  const isOwner =
    session.role === SATELLITE_ROLE.BUSINESS_OWNER || session.isOwner;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <PageHeader title="Executive summary" subtitle="Retail POS — owner view" />
      {!isOwner ? (
        <p className="mt-4 text-sm text-red-600">
          Access restricted to BUSINESS_OWNER (Finance OWNER/DIRECTOR via SSO).
        </p>
      ) : (
        <div className="mt-6 space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">
            Organization: {session.organizationId ?? "—"}
          </p>
          <p className="text-sm text-slate-600">
            Finance role: {session.financeRole ?? session.role}
          </p>
          <p className="text-sm">
            Billing and subscription management → Finance Core (not duplicated in
            satellite).
          </p>
        </div>
      )}
    </main>
  );
}
