import {
  applyQuotaRecalc,
  dailyRateQuotaTotal,
  weeklyQuotaTotal,
  clampStayNights,
  QuotaBelowMinError,
} from "@/lib/program-quota";
import {
  countedNightsForDailyRate,
  resolveBlockQuotaTotal,
} from "@/lib/sanatorium-scheduler.service";
import {
  packageBlockDayUseIsFull,
  packageBlockDayUseCount,
} from "@/domain/sanatorium/daily-package-cap";

describe("daily-rate quota", () => {
  /** Mon 2026-11-02 → Thu 2026-11-12 = 10 nights, Sundays Nov 8. */
  const checkIn = new Date("2026-11-02T12:00:00+04:00");
  const checkOut = new Date("2026-11-12T12:00:00+04:00");

  it("counts 10 nights with Sunday on, 9 without (one Sunday inside)", () => {
    expect(
      countedNightsForDailyRate({
        startsOn: checkIn,
        endsOn: checkOut,
        nights: 10,
        countSunday: true,
      }),
    ).toBe(10);
    expect(
      countedNightsForDailyRate({
        startsOn: checkIn,
        endsOn: checkOut,
        nights: 10,
        countSunday: false,
      }),
    ).toBe(9);
  });

  it("ceils counted nights × fractional quotaPerNight", () => {
    expect(dailyRateQuotaTotal({ countedNights: 6, quotaPerNight: 0.55 })).toBe(4);
    expect(dailyRateQuotaTotal({ countedNights: 6, quotaPerNight: 0.5 })).toBe(3);
    expect(dailyRateQuotaTotal({ countedNights: 9, quotaPerNight: 3 })).toBe(27);
    expect(dailyRateQuotaTotal({ countedNights: 9, quotaPerNight: 0 })).toBe(0);
  });

  it("weekly floor(nights/7) × quotaPerWeek", () => {
    expect(weeklyQuotaTotal({ nights: 7, quotaPerWeek: 1 })).toBe(1);
    expect(weeklyQuotaTotal({ nights: 10, quotaPerWeek: 1 })).toBe(1);
    expect(weeklyQuotaTotal({ nights: 14, quotaPerWeek: 1 })).toBe(2);
    expect(weeklyQuotaTotal({ nights: 21, quotaPerWeek: 1 })).toBe(3);
    expect(weeklyQuotaTotal({ nights: 21, quotaPerWeek: 2 })).toBe(6);
  });

  it("multiplies counted nights by quotaPerNight (integer rate)", () => {
    const counted = countedNightsForDailyRate({
      startsOn: checkIn,
      endsOn: checkOut,
      nights: 10,
      countSunday: false,
    });
    expect(dailyRateQuotaTotal({ countedNights: counted, quotaPerNight: 3 })).toBe(27);
    expect(
      resolveBlockQuotaTotal({
        quotaMode: "DAILY_RATE",
        countSunday: false,
        nights: 10,
        checkIn,
        endsOn: checkOut,
        procedure: {
          quotaTotal: 1,
          procedureCode: "PHYSIO_POOL",
          blockQuotaMode: "DAILY_RATE",
          quotaPerNight: 3,
        },
        knots: [],
      }),
    ).toBe(27);
  });

  it("dailyUseCap above quotaPerNight does not inflate stay total", () => {
    expect(
      resolveBlockQuotaTotal({
        quotaMode: "DAILY_RATE",
        countSunday: true,
        nights: 10,
        checkIn,
        endsOn: checkOut,
        procedure: {
          quotaTotal: 1,
          procedureCode: "PHYSIO_POOL",
          blockQuotaMode: "DAILY_RATE",
          quotaPerNight: 3,
        },
        knots: [],
      }),
    ).toBe(30);
  });

  it("WEEKLY block ignores knot grid and Sunday flag", () => {
    expect(
      resolveBlockQuotaTotal({
        quotaMode: "DAILY_RATE",
        countSunday: false,
        nights: 14,
        checkIn,
        endsOn: checkOut,
        procedure: {
          quotaTotal: 99,
          procedureCode: "HYDROCOLON",
          blockQuotaMode: "WEEKLY",
          quotaPerWeek: 1,
          quotaPerNight: 9,
        },
        knots: [{ nights: 14, procedureCode: "HYDROCOLON", qty: 50 }],
      }),
    ).toBe(2);
  });

  it("PER_STAY block uses flat quotaTotal on dynamic package", () => {
    expect(
      resolveBlockQuotaTotal({
        quotaMode: "DAILY_RATE",
        countSunday: true,
        nights: 14,
        checkIn,
        endsOn: checkOut,
        procedure: {
          quotaTotal: 5,
          procedureCode: "LAB_BLOCK",
          kind: "LAB",
          blockQuotaMode: "PER_STAY",
          quotaPerNight: 3,
        },
        knots: [{ nights: 14, procedureCode: "LAB_BLOCK", qty: 99 }],
      }),
    ).toBe(5);
  });

  it("mixed package resolves three block modes independently", () => {
    const bath = resolveBlockQuotaTotal({
      quotaMode: "DAILY_RATE",
      countSunday: true,
      nights: 6,
      checkIn,
      endsOn: checkOut,
      procedure: {
        quotaTotal: 1,
        procedureCode: "BATH",
        blockQuotaMode: "DAILY_RATE",
        quotaPerNight: 0.55,
      },
      knots: [],
    });
    const hydro = resolveBlockQuotaTotal({
      quotaMode: "DAILY_RATE",
      countSunday: true,
      nights: 14,
      checkIn,
      endsOn: checkOut,
      procedure: {
        quotaTotal: 1,
        procedureCode: "HYDRO",
        blockQuotaMode: "WEEKLY",
        quotaPerWeek: 1,
      },
      knots: [],
    });
    const lab = resolveBlockQuotaTotal({
      quotaMode: "DAILY_RATE",
      countSunday: true,
      nights: 14,
      checkIn,
      endsOn: checkOut,
      procedure: {
        quotaTotal: 2,
        procedureCode: "LAB",
        kind: "LAB",
        blockQuotaMode: "PER_STAY",
      },
      knots: [],
    });
    expect(bath).toBe(4);
    expect(hydro).toBe(2);
    expect(lab).toBe(2);
  });

  it("refuses below min nights", () => {
    expect(() =>
      clampStayNights(3, 5, 21),
    ).toThrow(QuotaBelowMinError);
  });

  it("recalc floors total at already used", () => {
    expect(applyQuotaRecalc(12, 9)).toEqual({ quotaTotal: 12, remaining: 0 });
    expect(applyQuotaRecalc(4, 27)).toEqual({ quotaTotal: 27, remaining: 23 });
  });

  it("FIXED still reads knot totals, not quotaPerNight", () => {
    expect(
      resolveBlockQuotaTotal({
        quotaMode: "FIXED",
        countSunday: false,
        nights: 10,
        checkIn,
        endsOn: checkOut,
        procedure: {
          quotaTotal: 1,
          procedureCode: "PHYSIO_POOL",
          quotaPerNight: 3,
        },
        knots: [
          { nights: 7, procedureCode: "PHYSIO_POOL", qty: 10 },
          { nights: 14, procedureCode: "PHYSIO_POOL", qty: 18 },
        ],
      }),
    ).toBe(13);
  });
});

describe("daily use cap (units)", () => {
  const day = new Date("2026-11-06T10:00:00+04:00");

  it("blocks a fifth unit when dailyUseCap is 4", () => {
    const slots = [
      { code: "A", start: day, inPackage: true, quotaKey: "PHYSIO_POOL" },
      { code: "B", start: day, inPackage: true, quotaKey: "PHYSIO_POOL" },
      { code: "C", start: day, inPackage: true, quotaKey: "PHYSIO_POOL" },
      { code: "D", start: day, inPackage: true, quotaKey: "PHYSIO_POOL" },
    ];
    expect(packageBlockDayUseCount({ slots, day, quotaKey: "PHYSIO_POOL" })).toBe(4);
    expect(
      packageBlockDayUseIsFull({ slots, day, quotaKey: "PHYSIO_POOL", cap: 4 }),
    ).toBe(true);
    expect(
      packageBlockDayUseIsFull({ slots, day, quotaKey: "PHYSIO_POOL", cap: 5 }),
    ).toBe(false);
  });
});
