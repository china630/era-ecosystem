import { todayBakuYmd } from "@era/satellite-kit/time";
import { departmentFinanceEventsSilenced } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { getClinicHotelOrganizationId } from "@/domain/physio/clinic-cutover.service";

type ConsumableLine = { sku?: string | null; qty?: number | null };

async function postHotelConsumption(payload: {
  organizationId: string;
  businessDate: string;
  sku: string;
  qty: number;
  source: string;
  sourceRef: string;
}) {
  const {
    PEER_SATELLITE_HOTEL,
    resolvePeerSatelliteBaseUrl,
    resolveSatelliteEventServiceToken,
  } = await import("@era/satellite-kit");
  const secret = resolveSatelliteEventServiceToken();
  if (!secret) throw new Error("SATELLITE_EVENT_SERVICE_TOKEN not configured");
  const base = (
    await resolvePeerSatelliteBaseUrl({
      organizationId: payload.organizationId,
      satelliteKey: PEER_SATELLITE_HOTEL,
    })
  ).baseUrl;
  const res = await fetch(`${base}/api/internal/v1/consumption`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Hotel consumption failed (${res.status})`);
  }
}

export async function flushConsumptionOutbox() {
  const pending = await prisma.consumptionOutbox.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  for (const row of pending) {
    try {
      const payload = JSON.parse(row.payloadJson) as {
        organizationId: string;
        businessDate: string;
        sku: string;
        qty: number;
        source: string;
        sourceRef: string;
      };
      await postHotelConsumption(payload);
      await prisma.consumptionOutbox.update({
        where: { id: row.id },
        data: { status: "SENT", sentAt: new Date(), lastError: null },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Hotel consumption failed";
      await prisma.consumptionOutbox.update({
        where: { id: row.id },
        data: { attempts: { increment: 1 }, lastError: message.slice(0, 500) },
      });
    }
  }
}

/** Department clinic only. A standalone clinic keeps the finance procedure event. */
export async function enqueueProcedureConsumables(orderId: string, lines: ConsumableLine[]) {
  const organizationId = requestOrganizationId();
  if (!organizationId) return;
  if (!(await departmentFinanceEventsSilenced(organizationId))) return;
  const hotelOrganizationId = await getClinicHotelOrganizationId(organizationId);
  if (!hotelOrganizationId) throw new Error("hotelOrganizationId required for procedure consumables");
  const businessDate = todayBakuYmd();
  let index = 0;
  for (const line of lines) {
    const sku = line.sku?.trim();
    const qty = Number(line.qty);
    if (!sku || !(qty > 0)) continue;
    const sourceRef = `clinic-proc:${orderId}:${index}`;
    index += 1;
    const payload = {
      organizationId: hotelOrganizationId,
      businessDate,
      sku,
      qty,
      source: "clinic",
      sourceRef,
    };
    await prisma.consumptionOutbox.upsert({
      where: { sourceRef },
      create: {
        organizationId,
        sourceRef,
        payloadJson: JSON.stringify(payload),
        status: "PENDING",
      },
      update: {},
    });
  }
  await flushConsumptionOutbox();
}
