import {
  applyQuotaRecalc,
  nightsBetween,
  quotaFor,
  QuotaBelowMinError,
  resolveQuotaChargeAmount,
} from "@/lib/program-quota";

/** Representative PDF knots (Standart baths / Premium baths). */
const STANDART_BATHS = [
  { nights: 5, procedureCode: "NAFTALAN_BATH", qty: 4 },
  { nights: 7, procedureCode: "NAFTALAN_BATH", qty: 5 },
  { nights: 8, procedureCode: "NAFTALAN_BATH", qty: 6 },
  { nights: 9, procedureCode: "NAFTALAN_BATH", qty: 7 },
  { nights: 10, procedureCode: "NAFTALAN_BATH", qty: 8 },
  { nights: 11, procedureCode: "NAFTALAN_BATH", qty: 8 },
  { nights: 12, procedureCode: "NAFTALAN_BATH", qty: 9 },
  { nights: 14, procedureCode: "NAFTALAN_BATH", qty: 10 },
  { nights: 21, procedureCode: "NAFTALAN_BATH", qty: 14 },
];

const PREMIUM_BATHS = [
  { nights: 7, procedureCode: "NAFTALAN_BATH", qty: 5 },
  { nights: 10, procedureCode: "NAFTALAN_BATH", qty: 8 },
  { nights: 14, procedureCode: "NAFTALAN_BATH", qty: 12 },
  { nights: 21, procedureCode: "NAFTALAN_BATH", qty: 16 },
];

describe("program-quota quotaFor", () => {
  it("Standart 12 nights baths = PDF 9", () => {
    expect(
      quotaFor({
        knots: STANDART_BATHS,
        nights: 12,
        procedureCode: "NAFTALAN_BATH",
        minNights: 5,
        maxNights: 21,
      }),
    ).toBe(9);
  });

  it("Premium 13 nights interpolates between 10 and 14", () => {
    expect(
      quotaFor({
        knots: PREMIUM_BATHS,
        nights: 13,
        procedureCode: "NAFTALAN_BATH",
        minNights: 7,
        maxNights: 21,
      }),
    ).toBe(11);
  });

  it("clamps above max nights", () => {
    expect(
      quotaFor({
        knots: STANDART_BATHS,
        nights: 30,
        procedureCode: "NAFTALAN_BATH",
        minNights: 5,
        maxNights: 21,
      }),
    ).toBe(14);
  });

  it("refuses below min nights", () => {
    expect(() =>
      quotaFor({
        knots: STANDART_BATHS,
        nights: 3,
        procedureCode: "NAFTALAN_BATH",
        minNights: 5,
        maxNights: 21,
      }),
    ).toThrow(QuotaBelowMinError);
  });

  it("nightsBetween uses UTC date parts", () => {
    expect(
      nightsBetween(new Date("2026-08-01T10:00:00Z"), new Date("2026-08-11T10:00:00Z")),
    ).toBe(10);
  });
});

describe("program-quota recalc", () => {
  it("extend nights: totals up, used unchanged", () => {
    const used = 2;
    const at10 = quotaFor({
      knots: STANDART_BATHS,
      nights: 10,
      procedureCode: "NAFTALAN_BATH",
      minNights: 5,
      maxNights: 21,
    });
    const at14 = quotaFor({
      knots: STANDART_BATHS,
      nights: 14,
      procedureCode: "NAFTALAN_BATH",
      minNights: 5,
      maxNights: 21,
    });
    expect(at10).toBe(8);
    expect(at14).toBe(10);
    const r = applyQuotaRecalc(used, at14);
    expect(r.quotaTotal).toBe(10);
    expect(r.remaining).toBe(8);
  });

  it("shorten nights: totals down, used preserved when used > new", () => {
    const used = 9;
    const at7 = quotaFor({
      knots: STANDART_BATHS,
      nights: 7,
      procedureCode: "NAFTALAN_BATH",
      minNights: 5,
      maxNights: 21,
    });
    expect(at7).toBe(5);
    const r = applyQuotaRecalc(used, at7);
    expect(r.quotaTotal).toBe(9);
    expect(r.remaining).toBe(0);
  });

  it("Standart→Premium baths: used 2, new total 6 → remaining 4", () => {
    // Simulate package change: Premium 10 nights = 8; use 6 as plan example intermediate
    const premium10 = quotaFor({
      knots: PREMIUM_BATHS,
      nights: 10,
      procedureCode: "NAFTALAN_BATH",
      minNights: 7,
      maxNights: 21,
    });
    expect(premium10).toBe(8);
    const r = applyQuotaRecalc(2, 6);
    expect(r.quotaTotal).toBe(6);
    expect(r.remaining).toBe(4);
  });
});

describe("program-quota charge", () => {
  it("in-quota → 0", () => {
    expect(
      resolveQuotaChargeAmount({
        hasProgramBalance: true,
        overQuota: false,
        walkInWithoutProgram: false,
        listPrice: 40,
      }),
    ).toBe(0);
  });

  it("over-quota → list price", () => {
    expect(
      resolveQuotaChargeAmount({
        hasProgramBalance: true,
        overQuota: true,
        walkInWithoutProgram: false,
        listPrice: 40,
      }),
    ).toBe(40);
  });

  it("walk-in without program → list price (fallback 25)", () => {
    expect(
      resolveQuotaChargeAmount({
        hasProgramBalance: false,
        overQuota: false,
        walkInWithoutProgram: true,
        listPrice: 0,
      }),
    ).toBe(25);
  });
});
