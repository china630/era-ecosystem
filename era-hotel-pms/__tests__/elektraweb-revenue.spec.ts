import {
  elektraRevenueTarget,
  resolveElektraRevenueCodeId,
  upsertElektraRevenueCode,
} from '@/lib/integration/elektraweb-revenue';

type Row = { id: string; code: string; name: string };

function fakeDb(rows: Row[]) {
  const store = [...rows];
  const ci = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const revenueCode = {
    findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
      const code = where.code as string | { equals: string } | undefined;
      const name = where.name as { equals: string } | undefined;
      if (typeof code === 'string') return store.find((r) => r.code === code) ?? null;
      if (code) return store.find((r) => ci(r.code, code.equals)) ?? null;
      if (name) return store.find((r) => ci(r.name, name.equals)) ?? null;
      return null;
    }),
    upsert: jest.fn(
      async ({ where, create, update }: { where: { code: string }; create: Row; update: Partial<Row> }) => {
        const hit = store.find((r) => r.code === where.code);
        if (hit) {
          Object.assign(hit, update);
          return hit;
        }
        const row = { ...create, id: `new-${create.code}` };
        store.push(row);
        return row;
      },
    ),
  };
  return { db: { revenueCode } as never, store, revenueCode };
}

describe('elektraRevenueTarget', () => {
  it('maps banquet names and codes to BANQUET', () => {
    expect(elektraRevenueTarget({ code: '45', name: 'Banket Gəliri' })).toMatchObject({
      code: 'BANQUET',
      canonical: true,
    });
    expect(elektraRevenueTarget({ code: 'BANKET' }).code).toBe('BANQUET');
  });

  it('maps known room / minibar / laundry names', () => {
    expect(elektraRevenueTarget({ code: '1', name: 'Room Revenue' }).code).toBe('ROOM');
    expect(elektraRevenueTarget({ code: '7', name: 'Mini Bar' }).code).toBe('MINIBAR');
    expect(elektraRevenueTarget({ code: '9', name: 'Laundry' }).code).toBe('LAUNDRY');
  });

  it('keeps an unknown Elektra code as its own code', () => {
    expect(elektraRevenueTarget({ code: 'spa medikal', name: 'SPA MEDIKAL' })).toMatchObject({
      code: 'SPA MEDIKAL',
      canonical: false,
      fallback: false,
    });
  });

  it('prefixes a bare numeric revenue id with EW-', () => {
    expect(elektraRevenueTarget({ numericId: 312, name: 'Transfer' })).toMatchObject({
      code: 'EW-312',
      name: 'Transfer',
    });
  });

  it('builds a code from the name when no code arrives', () => {
    expect(elektraRevenueTarget({ name: 'Parking fee' }).code).toBe('EW-PARKING_FEE');
  });

  it('falls back to ROOM only when neither code nor name arrives', () => {
    expect(elektraRevenueTarget({})).toMatchObject({ code: 'ROOM', fallback: true });
    expect(elektraRevenueTarget({ code: '  ', name: '' })).toMatchObject({ code: 'ROOM', fallback: true });
  });
});

describe('resolveElektraRevenueCodeId', () => {
  it('creates BANQUET when the catalog has no such row', async () => {
    const { db, store } = fakeDb([{ id: 'r1', code: 'ROOM', name: 'Room' }]);
    const id = await resolveElektraRevenueCodeId(db, { code: '45', name: 'Banquet' });
    expect(id).toBe('new-BANQUET');
    expect(store.some((r) => r.code === 'BANQUET')).toBe(true);
  });

  it('does not route an unknown code to ROOM', async () => {
    const { db, store } = fakeDb([{ id: 'r1', code: 'ROOM', name: 'Room' }]);
    const id = await resolveElektraRevenueCodeId(db, { numericId: 88, name: 'Bike rental' });
    expect(id).not.toBe('r1');
    expect(store.find((r) => r.id === id)?.code).toBe('EW-88');
  });

  it('matches an existing row by Elektra name before creating', async () => {
    const { db, revenueCode } = fakeDb([{ id: 'spa', code: 'SPA', name: 'Spa Medikal' }]);
    expect(await resolveElektraRevenueCodeId(db, { numericId: 5, name: 'SPA MEDIKAL' })).toBe('spa');
    expect(revenueCode.upsert).not.toHaveBeenCalled();
  });

  it('finds legacy EW-{id} rows', async () => {
    const { db } = fakeDb([{ id: 'legacy', code: 'EW-12', name: 'Old' }]);
    expect(await resolveElektraRevenueCodeId(db, { numericId: 12 })).toBe('legacy');
  });

  it('returns null without writing in lookup-only mode', async () => {
    const { db, revenueCode } = fakeDb([]);
    expect(await resolveElektraRevenueCodeId(db, { code: 'X1' }, { createMissing: false })).toBeNull();
    expect(revenueCode.upsert).not.toHaveBeenCalled();
  });
});

describe('upsertElektraRevenueCode', () => {
  it('writes the banquet import row onto BANQUET and only touches name/taxTag', async () => {
    const { db, store } = fakeDb([]);
    await upsertElektraRevenueCode(db, { code: 'BNQ', name: 'Banket', taxTag: '18%' }, false);
    expect(store).toEqual([expect.objectContaining({ code: 'BANQUET', name: 'Banket' })]);
  });

  it('reports created on dry run without writing', async () => {
    const { db, revenueCode } = fakeDb([]);
    expect(await upsertElektraRevenueCode(db, { code: 'ABC', name: 'Abc' }, true)).toBe('created');
    expect(revenueCode.upsert).not.toHaveBeenCalled();
  });
});
