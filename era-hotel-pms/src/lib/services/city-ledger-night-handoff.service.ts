import { requestOrganizationId } from '@/lib/request-organization';
import { requestFinanceCardIfMissing } from '@/lib/integration/finance-card-request';
import { prisma } from '@/lib/prisma';
import { issueFolioInvoice } from '@/lib/services/fiscal-document.service';

export type CityLedgerNightLine = {
  level: 'ok' | 'exception';
  message: string;
};

type PendingFolio = {
  id: string;
  reservationId: string;
  type: 'COMPANY' | 'AGENCY';
  reservation: {
    companyId: string | null;
    agencyId: string | null;
    company: { id: string; name: string; voen: string | null; financeCounterpartyId: string | null } | null;
    agency: { id: string; name: string; voen: string | null; financeCounterpartyId: string | null } | null;
  };
};

function financeApiBase(): string {
  return (process.env.ERA_FINANCE_API_URL ?? process.env.FINANCE_API_URL ?? '')
    .replace(/\/$/, '')
    .trim();
}

/** Read-only lookup. Null means Finance has no card. Throws on transport or auth failure. */
export async function lookupFinanceCounterpartyId(voen: string): Promise<string | null> {
  const base = financeApiBase();
  const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
  const orgId = requestOrganizationId();
  if (!base || !token || !orgId) {
    throw new Error('Finance API URL is not configured for City Ledger handoff');
  }
  const res = await fetch(
    `${base}/api/internal/v1/counterparties/by-voen?taxId=${encodeURIComponent(voen)}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, 'x-organization-id': orgId },
      signal: AbortSignal.timeout(8000),
    },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Finance counterparty lookup failed: HTTP ${res.status} ${text}`);
  }
  const body = (await res.json()) as { id?: string | null };
  return body.id ?? null;
}

/**
 * Night audit only. A known Finance card is linked and the folio becomes TRANSFERRED_AR.
 * A missing card is queued. The folio stays PENDING_AR.
 */
export async function handoffPendingCityLedger(
  asOfDate: string,
  folioId?: string,
): Promise<CityLedgerNightLine[]> {
  const lines: CityLedgerNightLine[] = [];
  const pending = await prisma.folio.findMany({
    where: {
      status: 'PENDING_AR',
      type: { in: ['COMPANY', 'AGENCY'] },
      ...(folioId ? { id: folioId } : {}),
    },
    include: {
      reservation: {
        select: {
          companyId: true,
          agencyId: true,
          company: { select: { id: true, name: true, voen: true, financeCounterpartyId: true } },
          agency: { select: { id: true, name: true, voen: true, financeCounterpartyId: true } },
        },
      },
    },
  });

  const snapshotCompanies = new Set<string>();
  const snapshotAgencies = new Set<string>();

  for (const folio of pending as PendingFolio[]) {
    const party = folio.type === 'COMPANY' ? folio.reservation.company : folio.reservation.agency;
    const label = party?.name?.trim() || folio.id;
    const voen = party?.voen?.trim() ?? '';
    if (!party || !/^\d{10}$/.test(voen)) {
      lines.push({
        level: 'exception',
        message: `City Ledger waiting: ${label} has no VÖEN; folio ${folio.id} stays PENDING_AR`,
      });
      continue;
    }

    let counterpartyId = party.financeCounterpartyId;
    if (!counterpartyId) {
      try {
        counterpartyId = await lookupFinanceCounterpartyId(voen);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Finance lookup failed';
        lines.push({
          level: 'exception',
          message: `City Ledger waiting: ${label} (${voen}) — ${msg}`,
        });
        continue;
      }
    }

    if (!counterpartyId) {
      await requestFinanceCardIfMissing({
        voen,
        name: party.name,
        partyKind: folio.type,
      });
      lines.push({
        level: 'exception',
        message: `City Ledger waiting: add Finance card for ${label} (${voen}); folio ${folio.id} stays PENDING_AR`,
      });
      continue;
    }

    if (party.financeCounterpartyId !== counterpartyId) {
      if (folio.type === 'COMPANY') {
        await prisma.company.update({
          where: { id: party.id },
          data: { financeCounterpartyId: counterpartyId },
        });
      } else {
        await prisma.agency.update({
          where: { id: party.id },
          data: { financeCounterpartyId: counterpartyId },
        });
      }
    }

    try {
      await issueFolioInvoice(folio.id);
      await prisma.folio.update({ where: { id: folio.id }, data: { status: 'TRANSFERRED_AR' } });
      if (folio.type === 'COMPANY' && folio.reservation.companyId) {
        snapshotCompanies.add(folio.reservation.companyId);
      }
      if (folio.type === 'AGENCY' && folio.reservation.agencyId) {
        snapshotAgencies.add(folio.reservation.agencyId);
      }
      await prisma.reservation.updateMany({
        where: {
          id: folio.reservationId,
          checkoutSettlementStatus: { in: ['PENDING', 'NOT_APPLICABLE'] },
        },
        data: { checkoutSettlementStatus: 'INVOICED' },
      });
      lines.push({
        level: 'ok',
        message: `City Ledger transferred: ${label} (${voen}), folio ${folio.id}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'invoice failed';
      lines.push({
        level: 'exception',
        message: `City Ledger invoice failed for ${label}, folio ${folio.id}: ${msg}`,
      });
    }
  }

  const { dispatchCityLedgerSnapshot, dispatchCompanyCityLedgerSnapshot } = await import(
    '@/lib/integration/event-dispatcher'
  );
  for (const companyId of snapshotCompanies) {
    try {
      await dispatchCompanyCityLedgerSnapshot(companyId, asOfDate);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'snapshot failed';
      lines.push({ level: 'exception', message: `Company City Ledger snapshot failed: ${msg}` });
    }
  }
  for (const agencyId of snapshotAgencies) {
    try {
      await dispatchCityLedgerSnapshot(agencyId, asOfDate);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'snapshot failed';
      lines.push({ level: 'exception', message: `Agency City Ledger snapshot failed: ${msg}` });
    }
  }

  if (pending.length === 0) {
    lines.push(
      folioId
        ? { level: 'exception', message: `City Ledger folio ${folioId} is not PENDING_AR` }
        : { level: 'ok', message: 'City Ledger handoff — no PENDING_AR folios' },
    );
  }
  return lines;
}
