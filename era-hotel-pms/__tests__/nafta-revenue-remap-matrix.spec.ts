import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REVENUE_CODE_ROLES, normalizeRevenueRole } from '@/lib/revenue-code-match';

type Matrix = {
  targetCodes: Array<{
    code: string;
    role: string | null;
    gl: string;
    allowManualCharge: boolean;
  }>;
  codeRemap: Record<string, string>;
  fbOutletCategoryRemap: Record<string, string>;
  retireCodes: string[];
};

describe('Nafta revenue remap matrix v2', () => {
  const matrix = JSON.parse(
    readFileSync(resolve(__dirname, '../../scripts/ops/nafta-revenue-remap-matrix.json'), 'utf8'),
  ) as Matrix;

  it('has dense lodging + clinic + F&B targets', () => {
    const codes = new Set(matrix.targetCodes.map((row) => row.code));
    expect(codes.has('1001')).toBe(true);
    expect(codes.has('1002')).toBe(true);
    expect(codes.has('1013')).toBe(true);
    expect(codes.has('1014')).toBe(true);
    expect(codes.has('2001')).toBe(true);
    expect(codes.has('2005')).toBe(true);
    expect(codes.has('4001')).toBe(true);
    expect(codes.has('4007')).toBe(true);
    expect(codes.has('2007')).toBe(false);
  });

  it('ROOM/PKG/CITY_TAX disallow manual charge', () => {
    for (const row of matrix.targetCodes) {
      if (row.role && ['ROOM', 'PKG', 'CITY_TAX'].includes(row.role)) {
        expect(row.allowManualCharge).toBe(false);
      }
    }
  });

  it('named roles are in REVENUE_CODE_ROLES', () => {
    for (const row of matrix.targetCodes) {
      if (!row.role) continue;
      const role = normalizeRevenueRole(row.role) ?? row.role;
      expect(REVENUE_CODE_ROLES as readonly string[]).toContain(role);
    }
  });

  it('remaps old BOARD/TREATMENT/outlet F&B and clinic junk', () => {
    expect(matrix.codeRemap['1003']).toBe('1002');
    expect(matrix.codeRemap['1004']).toBe('1002');
    expect(matrix.codeRemap['BOARD']).toBe('1002');
    expect(matrix.codeRemap['TREATMENT']).toBe('1002');
    expect(matrix.codeRemap['2006']).toBe('2005');
    expect(matrix.codeRemap['2007']).toBe('1002');
    expect(matrix.codeRemap['2005']).toBe('2001');
    expect(matrix.codeRemap['1018']).toBe('4001');
    expect(matrix.fbOutletCategoryRemap['01']).toBe('4001');
    expect(matrix.fbOutletCategoryRemap['02']).toBe('4002');
  });

  it('documents retire after remap', () => {
    expect(matrix.retireCodes.length).toBeGreaterThan(0);
    expect(matrix.retireCodes.some((row) => /deactivat|OLD-BOARD/i.test(row))).toBe(true);
  });
});
