import { readFileSync } from 'fs';
import { join } from 'path';

const ORG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORG_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

class MockCronOrganizationListError extends Error {
  code = 'CRON_ORG_LIST';
  constructor(public reason: string) {
    super(reason);
  }
}
class MockSatelliteOrganizationUnboundError extends Error {}

const mockAls: { organizationId?: string } = {};
const mockRows = [
  { organizationId: ORG_B, channexPropertyId: 'prop-b', ibePublishableKey: 'pk_b', provider: 'channex' },
];
const mockFindFirst = jest.fn(async ({ where }: { where: Record<string, string> }) => {
  const org = mockAls.organizationId;
  if (!org) throw new Error('tenant filter: no organization bound');
  return (
    mockRows.find(
      (r) =>
        r.organizationId === org &&
        Object.entries(where).every(([k, v]) => (r as Record<string, unknown>)[k] === v),
    ) ?? null
  );
});
const mockListOrgs = jest.fn(async () => [ORG_A, ORG_B]);

jest.mock('@era/satellite-kit', () => ({
  CronOrganizationListError: MockCronOrganizationListError,
  SatelliteOrganizationUnboundError: MockSatelliteOrganizationUnboundError,
  fetchChannexClientConfig: jest.fn(),
  listCronOrganizationIds: (...args: unknown[]) => mockListOrgs(...(args as [])),
  runWithSatelliteTenant: async <T>(ctx: { organizationId?: string }, fn: () => Promise<T>) => {
    const prev = mockAls.organizationId;
    mockAls.organizationId = ctx.organizationId;
    try {
      return await fn();
    } finally {
      mockAls.organizationId = prev;
    }
  },
}));
jest.mock('@/lib/prisma', () => ({ prisma: { channelManagerBinding: { findFirst: mockFindFirst } } }));
jest.mock('@/lib/cron-organization-ids', () => ({ fetchHotelPoolOrganizationIds: jest.fn() }));
jest.mock('@/lib/crypto/secret-box', () => ({
  decryptSecret: jest.fn(),
  encryptSecret: jest.fn(),
}));
jest.mock('@/lib/channel/channex-api', () => ({ isChannexProductionBase: jest.fn() }));

import {
  getChannelManagerBindingByIbeKey,
  getChannelManagerBindingByPropertyId,
  isBindingPoolUnavailable,
} from '@/lib/channel/channel-manager-binding.service';

const root = join(__dirname, '..');

describe('channel manager tenant isolation', () => {
  beforeEach(() => {
    mockFindFirst.mockClear();
    mockListOrgs.mockReset();
    mockListOrgs.mockResolvedValue([ORG_A, ORG_B]);
  });

  it('finds the binding by Channex property id org by org with the filter on', async () => {
    const row = await getChannelManagerBindingByPropertyId('prop-b');
    expect(row?.organizationId).toBe(ORG_B);
    expect(mockFindFirst).toHaveBeenCalledTimes(2);
    expect(mockFindFirst).toHaveBeenNthCalledWith(1, { where: { channexPropertyId: 'prop-b' } });
  });

  it('finds the binding by IBE key and returns null for an unknown key', async () => {
    expect((await getChannelManagerBindingByIbeKey('pk_b'))?.organizationId).toBe(ORG_B);
    expect(await getChannelManagerBindingByIbeKey('pk_unknown')).toBeNull();
  });

  it('registry failure surfaces as pool-unavailable (no unfiltered fallback)', async () => {
    mockListOrgs.mockRejectedValueOnce(
      new MockCronOrganizationListError('pool_registry_empty'),
    );
    const err = await getChannelManagerBindingByPropertyId('prop-b').catch((e) => e);
    expect(isBindingPoolUnavailable(err)).toBe(true);
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it('Channex webhook enters request tenant only after property bind', () => {
    const src = readFileSync(join(root, 'app/api/integrations/channex/webhook/route.ts'), 'utf8');
    expect(src.indexOf('enterRequestTenant(')).toBeGreaterThan(
      src.indexOf('getChannelManagerBindingByPropertyId('),
    );
    expect(src).toContain('fetchBookingRevision');
    expect(src).toContain('ackBookingRevision');
  });
});
