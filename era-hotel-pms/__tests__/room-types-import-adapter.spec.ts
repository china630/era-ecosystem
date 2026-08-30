jest.mock('@/lib/prisma', () => ({
  prisma: {
    roomType: {
      findFirst: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    },
  },
}));

jest.mock('@/lib/import/excel', () => ({
  parseWorkbook: jest.fn(),
}));

import { mapHeaders } from '@/lib/import/helpers';
import { parseWorkbook } from '@/lib/import/excel';
import { roomTypesAdapter } from '@/lib/import/adapters/room-types.adapter';
import { runImport } from '@/lib/import/run-import';

const EW_ALIASES = roomTypesAdapter.headerAliases;

function mapEw(row: Record<string, unknown>) {
  return roomTypesAdapter.mapRow(mapHeaders(row, EW_ALIASES));
}

describe('room-types import adapter', () => {
  it('maps a guest room type from Elektraweb headers', () => {
    const row = mapEw({
      'Room Type Code': 'STWN',
      'Room Type Name': 'Standart Twin',
      'Max Adult': 2,
      'Room Count': 36,
    });
    expect(row).toEqual({
      code: 'STWN',
      name: 'Standart Twin',
      baseQuota: 36,
      adultCapacity: 2,
    });
    expect(roomTypesAdapter.rowSchema.parse(row)).toMatchObject({ code: 'STWN', baseQuota: 36 });
  });

  it('keeps BANQUET Room Count=0 as quota 0 (not a validation error)', () => {
    const row = mapEw({
      'Room Type Code': 'BANQUET',
      'Room Type Name': 'BANQUET',
      'Max Adult': 3,
      'Room Count': 0,
    });
    expect(row).toMatchObject({ code: 'BANQUET', baseQuota: 0, adultCapacity: 3 });
    expect(roomTypesAdapter.rowSchema.parse(row).baseQuota).toBe(0);
  });

  it('skips EW totals footer (empty code/name, Room Count = inventory sum)', () => {
    expect(
      mapEw({
        Id: 0,
        'Room Type Name': null,
        'Room Type Code': null,
        'Max Adult': 0,
        'Room Count': 78,
      }),
    ).toBeNull();
    expect(
      mapEw({
        'Room Type Name': null,
        'Room Type Code': null,
        'Room Count': 78,
      }),
    ).toBeNull();
  });

  it('treats Max Adult=0 as default 2', () => {
    const row = mapEw({
      'Room Type Code': 'X',
      'Room Type Name': 'X',
      'Max Adult': 0,
      'Room Count': 1,
    });
    expect(row).toMatchObject({ adultCapacity: 2, baseQuota: 1 });
  });

  it('runImport skips footer and creates BANQUET with quota 0', async () => {
    (parseWorkbook as jest.Mock).mockReturnValue({
      sheetName: 'Room types',
      rows: [
        {
          'Room Type Code': 'STWN',
          'Room Type Name': 'Standart Twin',
          'Max Adult': 2,
          'Room Count': 36,
        },
        {
          'Room Type Code': 'BANQUET',
          'Room Type Name': 'BANQUET',
          'Max Adult': 3,
          'Room Count': 0,
        },
        { 'Room Type Code': null, 'Room Type Name': null, 'Max Adult': 0, 'Room Count': 78 },
        { 'Room Type Code': null, 'Room Type Name': null, 'Room Count': 78 },
      ],
    });
    const result = await runImport(roomTypesAdapter, Buffer.from([]), true);
    expect(result.errors).toEqual([]);
    expect(result.created).toBe(2);
    expect(result.skipped).toBe(2);
  });
});
