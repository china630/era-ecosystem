import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  authCookieName,
  hasPlatformCapability,
  verifySatelliteSession,
} from "@era/satellite-kit";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { prisma } from "@/lib/prisma";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

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

  let summary: {
    date: string;
    visitsToday: number;
    labRevenueToday: number;
    openLabOrders: number;
  } | null = null;

  if (canView) {
    const today = startOfToday();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [visitsToday, labCompletedToday, openLabOrders] = await Promise.all([
      prisma.visit.count({
        where: { createdAt: { gte: today, lt: tomorrow } },
      }),
      prisma.labOrder.findMany({
        where: {
          status: "COMPLETED",
          completedAt: { gte: today, lt: tomorrow },
        },
        select: { amountNet: true },
      }),
      prisma.labOrder.count({
        where: { status: { not: "COMPLETED" } },
      }),
    ]);

    summary = {
      date: today.toISOString().slice(0, 10),
      visitsToday,
      labRevenueToday: labCompletedToday.reduce(
        (sum, o) => sum + Number(o.amountNet),
        0,
      ),
      openLabOrders,
    };
  }

  return (
    <>
      <PageHeader
        title="Executive summary"
        subtitle="K-14 — daily clinic KPIs (no GL in satellite)"
        actions={
          <Link href="/" className={PRIMARY_BUTTON_CLASS}>
            Home
          </Link>
        }
      />
      <div className={`${CARD_CONTAINER_CLASS} p-6`}>
        {!canView ? (
          <p className="text-[13px] text-red-600">
            Access restricted to BUSINESS_OWNER (Finance OWNER/DIRECTOR via SSO).
          </p>
        ) : !summary ? (
          <p className="text-[13px] text-[#7F8C8D]">Unable to load summary.</p>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-3 text-[13px]">
            <div className="rounded border p-4">
              <dt className="text-[#7F8C8D]">Visits today</dt>
              <dd className="text-2xl font-semibold">{summary.visitsToday}</dd>
            </div>
            <div className="rounded border p-4">
              <dt className="text-[#7F8C8D]">Lab revenue today</dt>
              <dd className="text-2xl font-semibold">
                {summary.labRevenueToday.toFixed(2)} AZN
              </dd>
            </div>
            <div className="rounded border p-4">
              <dt className="text-[#7F8C8D]">Open lab orders</dt>
              <dd className="text-2xl font-semibold">{summary.openLabOrders}</dd>
            </div>
          </dl>
        )}
      </div>
    </>
  );
}
