jest.mock('@/lib/prisma', () => ({
  prisma: {
    folio: { findMany: jest.fn(), update: jest.fn() },
    company: { update: jest.fn() },
    agency: { update: jest.fn() },
    reservation: { updateMany: jest.fn() },
  },
}));
jest.mock('@/lib/integration/finance-card-request', () => ({
  requestFinanceCardIfMissing: jest.fn(),
}));
jest.mock('@/lib/services/fiscal-document.service', () => ({
  issueFolioInvoice: jest.fn(),
}));
jest.mock('@/lib/integration/event-dispatcher', () => ({
  dispatchCompanyCityLedgerSnapshot: jest.fn(),
  dispatchCityLedgerSnapshot: jest.fn(),
}));
jest.mock('@/lib/request-organization', () => ({
  requestOrganizationId: () => 'org-1',
}));

import { prisma } from '@/lib/prisma';
import { requestFinanceCardIfMissing } from '@/lib/integration/finance-card-request';
import { issueFolioInvoice } from '@/lib/services/fiscal-document.service';
import { dispatchCompanyCityLedgerSnapshot } from '@/lib/integration/event-dispatcher';
import { handoffPendingCityLedger } from '@/lib/services/city-ledger-night-handoff.service';

const folioFindMany = prisma.folio.findMany as jest.Mock;
const folioUpdate = prisma.folio.update as jest.Mock;
const companyUpdate = prisma.company.update as jest.Mock;

function companyFolio(financeCounterpartyId: string | null) {
  return {
    id: 'folio-1',
    reservationId: 'stay-1',
    type: 'COMPANY',
    reservation: {
      companyId: 'co-1',
      agencyId: null,
      company: {
        id: 'co-1',
        name: 'Foton MMC',
        voen: '1234567890',
        financeCounterpartyId,
      },
      agency: null,
    },
  };
}

describe('handoffPendingCityLedger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ERA_FINANCE_API_URL = 'http://finance-core:4100';
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = 'token';
  });

  it('transfers the folio when Finance already has the card', async () => {
    folioFindMany.mockResolvedValue([companyFolio(null)]);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'cp-1' }),
      text: async () => '',
    }) as unknown as typeof fetch;

    const lines = await handoffPendingCityLedger('2026-11-04');

    expect(companyUpdate).toHaveBeenCalledWith({
      where: { id: 'co-1' },
      data: { financeCounterpartyId: 'cp-1' },
    });
    expect(issueFolioInvoice).toHaveBeenCalledWith('folio-1');
    expect(folioUpdate).toHaveBeenCalledWith({
      where: { id: 'folio-1' },
      data: { status: 'TRANSFERRED_AR' },
    });
    expect(dispatchCompanyCityLedgerSnapshot).toHaveBeenCalledWith('co-1', '2026-11-04');
    expect(lines.some((line) => line.level === 'ok' && line.message.includes('transferred'))).toBe(
      true,
    );
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain(
      'http://finance-core:4100/api/internal/v1/counterparties/by-voen',
    );
  });

  it('queues a card request and leaves PENDING_AR when Finance has no card', async () => {
    folioFindMany.mockResolvedValue([companyFolio(null)]);
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
      text: async () => '',
    }) as unknown as typeof fetch;

    const lines = await handoffPendingCityLedger('2026-11-04');

    expect(requestFinanceCardIfMissing).toHaveBeenCalledWith({
      voen: '1234567890',
      name: 'Foton MMC',
      partyKind: 'COMPANY',
    });
    expect(issueFolioInvoice).not.toHaveBeenCalled();
    expect(folioUpdate).not.toHaveBeenCalled();
    expect(lines.some((line) => line.level === 'exception' && line.message.includes('add Finance card'))).toBe(
      true,
    );
  });
});
