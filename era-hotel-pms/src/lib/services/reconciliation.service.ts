import { prisma } from '@/lib/prisma';
import { decimalToNumber } from '@/lib/decimal';
import type { NightAuditPayload } from '@/lib/integration/event-types';

export async function getReconciliationReport(businessDate: string) {
  const date = new Date(businessDate);
  date.setHours(0, 0, 0, 0);
  const next = new Date(date);
  next.setDate(next.getDate() + 1);

  const charges = await prisma.folioCharge.findMany({
    where: { businessDate: { gte: date, lt: next } },
    include: { revenueCode: true },
  });

  const folioByCode = new Map<string, number>();
  for (const c of charges) {
    const code = c.revenueCode.code;
    folioByCode.set(code, (folioByCode.get(code) ?? 0) + decimalToNumber(c.amount) * c.qty);
  }

  const e1Log = await prisma.outboundEventLog.findFirst({
    where: {
      eventType: 'SATELLITE_HOTEL_NIGHT_AUDIT_CLOSED',
      status: 'SENT',
      createdAt: { gte: date, lt: next },
    },
    orderBy: { createdAt: 'desc' },
  });

  let e1ByCode = new Map<string, number>();
  if (e1Log) {
    try {
      const envelope = JSON.parse(e1Log.payloadJson) as { payload: NightAuditPayload };
      for (const line of envelope.payload.revenueLines ?? envelope.payload.lines ?? []) {
        e1ByCode.set(line.revenueCode, line.amount);
      }
    } catch {
      e1ByCode = new Map();
    }
  }

  const lines = [...new Set([...folioByCode.keys(), ...e1ByCode.keys()])].map((code) => {
    const folio = folioByCode.get(code) ?? 0;
    const e1 = e1ByCode.get(code) ?? 0;
    return { revenueCode: code, folioAmount: folio, e1Amount: e1, delta: folio - e1 };
  });

  const totalDelta = lines.reduce((s, l) => s + l.delta, 0);

  return {
    businessDate,
    folioTotal: [...folioByCode.values()].reduce((a, b) => a + b, 0),
    e1Total: [...e1ByCode.values()].reduce((a, b) => a + b, 0),
    totalDelta,
    matched: Math.abs(totalDelta) < 0.01,
    lines,
    e1CorrelationId: e1Log?.id ?? null,
  };
}
