jest.mock('@/lib/integration/elektraweb-bridge/config', () => ({
  bridgeRequestOrganizationId: () => 'org-1',
}));
jest.mock('@/lib/prisma', () => ({ prisma: {} }));

import {
  channelLabelForRateCode,
  classifyElektraRateCode,
  resolveElektraSellPath,
  upsertElektraRateCode,
} from '@/lib/integration/elektraweb-sell-path';

type Plan = { id: string; code: string; name: string; type?: string; active?: boolean };

function fakeDb(opts: { plans?: Plan[]; agencies?: Array<{ id: string; code: string; name: string }> } = {}) {
  const plans = [...(opts.plans ?? [])];
  const agencies = [...(opts.agencies ?? [])];
  const sources: Array<{ id: string; code: string }> = [];
  const ci = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const db = {
    ratePlan: {
      findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if (typeof where.code === 'string') return plans.find((p) => p.code === where.code) ?? null;
        const or = where.OR as Array<{ code?: { equals: string }; name?: { equals: string } }> | undefined;
        if (or) {
          return (
            plans.find((p) =>
              or.some((c) => (c.code && ci(p.code, c.code.equals)) || (c.name && ci(p.name, c.name.equals))),
            ) ?? null
          );
        }
        return null;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<Plan> }) => {
        const p = plans.find((x) => x.id === where.id)!;
        Object.assign(p, data);
        return p;
      }),
      create: jest.fn(async ({ data }: { data: Plan }) => {
        const p = { ...data, id: `plan-${data.code}` };
        plans.push(p);
        return p;
      }),
      upsert: jest.fn(async ({ create }: { create: Plan }) => {
        const p = { ...create, id: `plan-${create.code}` };
        plans.push(p);
        return p;
      }),
    },
    agency: {
      findMany: jest.fn(async () => agencies),
      findFirst: jest.fn(async () => null),
      create: jest.fn(async ({ data }: { data: { code: string; name: string } }) => {
        const a = { id: `agency-${data.code}`, code: data.code, name: data.name };
        agencies.push(a);
        return a;
      }),
    },
    bookingSource: {
      findMany: jest.fn(async () => sources),
      upsert: jest.fn(async ({ create }: { create: { code: string } }) => {
        const s = { id: `source-${create.code}`, code: create.code };
        sources.push(s);
        return s;
      }),
    },
  };
  return { db: db as never, plans, agencies, raw: db };
}

describe('classifyElektraRateCode', () => {
  it('treats OTA-like rate codes as channels', () => {
    expect(classifyElektraRateCode({ code: 'BOOKING.COM' })).toEqual({
      kind: 'channel',
      channelLabel: 'Booking.com',
    });
    expect(classifyElektraRateCode({ code: 'EXPEDIA NR' })).toMatchObject({ channelLabel: 'Expedia' });
    expect(classifyElektraRateCode({ code: 'HALAL' })).toMatchObject({ channelLabel: 'HalalBooking' });
  });

  it('keeps BAR, BAR-* and packages as rate plans', () => {
    expect(classifyElektraRateCode({ code: 'BAR', name: 'Channel' })).toEqual({ kind: 'rate', code: 'BAR' });
    expect(classifyElektraRateCode({ code: 'BAR-OTA' })).toEqual({ kind: 'rate', code: 'BAR-OTA' });
    expect(classifyElektraRateCode({ code: 'PKG BOOKING MED' })).toEqual({ kind: 'rate', code: 'PKG BOOKING MED' });
  });

  it('keeps ordinary rate codes', () => {
    expect(classifyElektraRateCode({ code: 'RACK', name: 'Daily rates' })).toEqual({ kind: 'rate', code: 'RACK' });
  });

  it('labels unknown channels by their name', () => {
    expect(channelLabelForRateCode('OTA-XYZ', 'Some OTA')).toBe('Some OTA');
  });
});

describe('resolveElektraSellPath', () => {
  it('prices a channel stay on BAR and returns OTA source + channel agency', async () => {
    const { db, plans } = fakeDb({
      plans: [{ id: 'bar', code: 'BAR', name: 'Best Available Rate', type: 'BASE', active: true }],
      agencies: [{ id: 'bk', code: 'BOOKING_COM', name: 'Booking.com LLC' }],
    });
    const out = await resolveElektraSellPath(db, { code: 'BOOKING' });
    expect(out).toEqual({ ratePlanId: 'bar', sourceId: 'source-BOOKING', agencyId: 'bk', channel: true });
    expect(plans.some((p) => p.code === 'BOOKING')).toBe(false);
  });

  it('resolves a real rate code by code', async () => {
    const { db } = fakeDb({ plans: [{ id: 'rack', code: 'RACK', name: 'Rack' }] });
    expect(await resolveElektraSellPath(db, { code: 'rack' })).toMatchObject({
      ratePlanId: 'rack',
      channel: false,
      sourceId: null,
    });
  });

  it('falls back to BAR for an unknown rate code', async () => {
    const { db } = fakeDb({ plans: [] });
    const out = await resolveElektraSellPath(db, { code: 'NOPE' });
    expect(out.ratePlanId).toBe('plan-BAR');
  });
});

describe('upsertElektraRateCode', () => {
  it('never creates a rate plan for a channel code on re-import', async () => {
    const { db, plans, agencies, raw } = fakeDb();
    expect(await upsertElektraRateCode(db, { code: 'EXPEDIA', name: 'OTA' }, false)).toBe('skipped');
    expect(raw.ratePlan.upsert).not.toHaveBeenCalled();
    expect(plans).toHaveLength(0);
    expect(agencies.map((a) => a.name)).toEqual(['Expedia']);
  });

  it('upserts real rate codes', async () => {
    const { db, raw } = fakeDb();
    expect(await upsertElektraRateCode(db, { code: 'CORP10', name: 'Corporate 10%' }, false)).toBe('created');
    expect(raw.ratePlan.upsert).toHaveBeenCalledTimes(1);
  });

  it('dry run writes nothing for channels', async () => {
    const { db, raw } = fakeDb();
    expect(await upsertElektraRateCode(db, { code: 'AGODA', name: 'Agoda' }, true)).toBe('skipped');
    expect(raw.agency.create).not.toHaveBeenCalled();
    expect(raw.bookingSource.upsert).not.toHaveBeenCalled();
  });
});
