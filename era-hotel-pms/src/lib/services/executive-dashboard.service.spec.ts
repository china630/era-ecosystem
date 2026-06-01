import { computeAdr, computeRevpar } from './executive-dashboard.service';

describe('executive-dashboard KPI formulas', () => {
  it('computes ADR as room revenue / rooms sold', () => {
    expect(computeAdr(1200, 10)).toBe(120);
    expect(computeAdr(0, 0)).toBe(0);
  });

  it('computes RevPAR as room revenue / total rooms', () => {
    expect(computeRevpar(1200, 100)).toBe(12);
    expect(computeRevpar(500, 50)).toBe(10);
    expect(computeRevpar(0, 0)).toBe(0);
  });
});
