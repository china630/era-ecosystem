import { planBathSeries, strayBathOrderIds, type StayDay } from "@/domain/planning/bath-calendar";

function week(): StayDay[] {
  return [
    { ymd: "2026-10-05", working: true },
    { ymd: "2026-10-06", working: true },
    { ymd: "2026-10-07", working: true },
    { ymd: "2026-10-08", working: true },
    { ymd: "2026-10-09", working: true },
    { ymd: "2026-10-10", working: true },
    { ymd: "2026-10-11", working: false },
  ];
}

describe("planBathSeries", () => {
  it("lays mode 2 as two baths then a rest, and a closed Sunday does not add a second rest", () => {
    const cells = planBathSeries({
      days: week(),
      series: [
        {
          seriesCode: "NAFTALAN",
          procedureCode: "SVC-NAFTALAN-VANNASI-KISI",
          mark: "Нм",
          mode: "2",
          qty: 4,
          fillsRestDays: false,
        },
      ],
      kept: [],
    });
    expect(cells.map((cell) => cell.ymd)).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-08",
      "2026-10-09",
    ]);
  });

  it("resets a streak on a closed day and does not spend the owed rest", () => {
    const days = week().map((day) =>
      day.ymd === "2026-10-07" ? { ...day, working: false } : day,
    );
    const cells = planBathSeries({
      days,
      series: [
        {
          seriesCode: "NAFTALAN",
          procedureCode: "SVC-NAFTALAN-VANNASI-KISI",
          mark: "Нм",
          mode: "3",
          qty: 4,
          fillsRestDays: false,
        },
      ],
      kept: [],
    });
    expect(cells.map((cell) => cell.ymd)).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-08",
      "2026-10-09",
    ]);
  });

  it("spends owed rest on a closed day so Monday can take a bath", () => {
    const cells = planBathSeries({
      days: [
        { ymd: "2026-10-08", working: true },
        { ymd: "2026-10-09", working: true },
        { ymd: "2026-10-10", working: true },
        { ymd: "2026-10-11", working: false },
        { ymd: "2026-10-12", working: true },
      ],
      series: [
        {
          seriesCode: "NAFTALAN",
          procedureCode: "SVC-NAFTALAN-VANNASI-KISI",
          mark: "Нм",
          mode: "3",
          qty: 4,
          fillsRestDays: false,
        },
      ],
      kept: [],
    });
    expect(cells.map((cell) => cell.ymd)).toEqual([
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-12",
    ]);
  });

  it("can keep the old rule: closed day does not spend owed rest", () => {
    const cells = planBathSeries({
      days: [
        { ymd: "2026-10-09", working: true },
        { ymd: "2026-10-10", working: true },
        { ymd: "2026-10-11", working: false },
        { ymd: "2026-10-12", working: true },
        { ymd: "2026-10-13", working: true },
      ],
      series: [
        {
          seriesCode: "NAFTALAN",
          procedureCode: "SVC-NAFTALAN-VANNASI-KISI",
          mark: "Нм",
          mode: "2",
          qty: 3,
          fillsRestDays: false,
        },
      ],
      kept: [],
      policy: { closedDaySpendsOwedRest: false, closedDayResetsOpenStreak: true },
    });
    expect(cells.map((cell) => cell.ymd)).toEqual([
      "2026-10-09",
      "2026-10-10",
      "2026-10-13",
    ]);
  });

  it("lays Monday start as five naftalan and iodine on Thursday", () => {
    const cells = planBathSeries({
      days: week(),
      series: [
        {
          seriesCode: "NAFTALAN",
          procedureCode: "SVC-NAFTALAN-VANNASI-KISI",
          mark: "Нм",
          mode: "3",
          qty: 5,
          fillsRestDays: false,
        },
        {
          seriesCode: "IODINE",
          procedureCode: "SVC-YOD-BROM-VANNASI",
          mark: "Й",
          mode: "3",
          qty: 1,
          fillsRestDays: true,
        },
      ],
      kept: [],
    });
    expect(
      cells.filter((cell) => cell.seriesCode === "NAFTALAN").map((cell) => cell.ymd),
    ).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-09", "2026-10-10"]);
    expect(cells.find((cell) => cell.procedureCode === "SVC-YOD-BROM-VANNASI")?.ymd).toBe(
      "2026-10-08",
    );
  });

  it("lays a Tuesday start as four naftalan and rest on Friday", () => {
    const cells = planBathSeries({
      days: week().slice(1),
      series: [
        {
          seriesCode: "NAFTALAN",
          procedureCode: "SVC-NAFTALAN-VANNASI-KISI",
          mark: "Нм",
          mode: "3",
          qty: 5,
          fillsRestDays: false,
        },
      ],
      kept: [],
    });
    expect(cells.map((cell) => cell.ymd)).toEqual([
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-10",
    ]);
  });

  it("resets a Friday–Saturday streak on Sunday so Monday starts a new three", () => {
    const cells = planBathSeries({
      days: [
        { ymd: "2026-10-09", working: true },
        { ymd: "2026-10-10", working: true },
        { ymd: "2026-10-11", working: false },
        { ymd: "2026-10-12", working: true },
        { ymd: "2026-10-13", working: true },
        { ymd: "2026-10-14", working: true },
      ],
      series: [
        {
          seriesCode: "NAFTALAN",
          procedureCode: "SVC-NAFTALAN-VANNASI-KISI",
          mark: "Нм",
          mode: "3",
          qty: 5,
          fillsRestDays: false,
        },
      ],
      kept: [],
    });
    expect(cells.map((cell) => cell.ymd)).toEqual([
      "2026-10-09",
      "2026-10-10",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
    ]);
  });

  it("caps naftalan at five in a seven-day working week", () => {
    const days: StayDay[] = [
      { ymd: "2026-10-05", working: true },
      { ymd: "2026-10-06", working: true },
      { ymd: "2026-10-07", working: true },
      { ymd: "2026-10-08", working: true },
      { ymd: "2026-10-09", working: true },
      { ymd: "2026-10-10", working: true },
      { ymd: "2026-10-11", working: true },
    ];
    const cells = planBathSeries({
      days,
      series: [
        {
          seriesCode: "NAFTALAN",
          procedureCode: "SVC-NAFTALAN-VANNASI-KISI",
          mark: "Нм",
          mode: "3",
          qty: 7,
          fillsRestDays: false,
        },
        {
          seriesCode: "IODINE",
          procedureCode: "SVC-YOD-BROM-VANNASI",
          mark: "Й",
          mode: "3",
          qty: 2,
          fillsRestDays: true,
        },
      ],
      kept: [],
      policy: { weeklyNaftalanCap: 5 },
    });
    expect(cells.filter((cell) => cell.seriesCode === "NAFTALAN")).toHaveLength(5);
    expect(cells.some((cell) => cell.procedureCode === "SVC-YOD-BROM-VANNASI")).toBe(true);
  });

  it("keeps a manual rest and continues the next block on the next working day", () => {
    const cells = planBathSeries({
      days: week(),
      series: [
        {
          seriesCode: "NAFTALAN",
          procedureCode: "SVC-NAFTALAN-VANNASI-KISI",
          mark: "Нм",
          mode: "3",
          qty: 5,
          fillsRestDays: false,
        },
      ],
      kept: [
        { ymd: "2026-10-05", procedureCode: "SVC-NAFTALAN-VANNASI-KISI", locked: true },
        { ymd: "2026-10-06", procedureCode: "SVC-NAFTALAN-VANNASI-KISI", locked: true },
        { ymd: "2026-10-07", procedureCode: "SVC-NAFTALAN-VANNASI-KISI", locked: false, manualRest: true },
      ],
    });
    expect(cells.map((cell) => cell.ymd)).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
    ]);
  });

  it("lets a rest-filling series use a day the first series left empty", () => {
    const cells = planBathSeries({
      days: week().slice(0, 3),
      series: [
        {
          seriesCode: "NAFTALAN",
          procedureCode: "SVC-NAFTALAN-VANNASI-KISI",
          mark: "Нм",
          mode: "2",
          qty: 2,
          fillsRestDays: false,
        },
        {
          seriesCode: "IODINE",
          procedureCode: "SVC-YOD-BROM-VANNASI",
          mark: "Й",
          mode: "2",
          qty: 1,
          fillsRestDays: true,
        },
      ],
      kept: [],
    });
    const iodine = cells.find((cell) => cell.procedureCode === "SVC-YOD-BROM-VANNASI");
    expect(iodine?.ymd).toBe("2026-10-07");
  });

  it("redraws automatic days around a manual pin when the mode changes", () => {
    const cells = planBathSeries({
      days: week(),
      layout: "fresh",
      series: [
        {
          seriesCode: "NAFTALAN",
          procedureCode: "SVC-NAFTALAN-VANNASI-KISI",
          mark: "Нм",
          mode: "2",
          qty: 4,
          fillsRestDays: false,
        },
      ],
      kept: [{ ymd: "2026-10-07", procedureCode: "SVC-NAFTALAN-VANNASI-KISI", locked: true }],
    });
    expect(cells.map((cell) => cell.ymd)).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-09",
    ]);
  });

  it("marks the first session sitting and the rest full", () => {
    const cells = planBathSeries({
      days: week().slice(0, 3),
      series: [
        {
          seriesCode: "NAFTALAN",
          procedureCode: "SVC-NAFTALAN-VANNASI-KISI",
          mark: "Нм",
          mode: "2",
          qty: 2,
          fillsRestDays: false,
          sitzThenFull: true,
        },
      ],
      kept: [],
    });
    expect(cells.map((cell) => cell.fill)).toEqual(["OTURAQ", "TAM"]);
  });

  it("does not place a new automatic bath before notBeforeYmd", () => {
    const cells = planBathSeries({
      days: week(),
      series: [
        {
          seriesCode: "NAFTALAN",
          procedureCode: "SVC-NAFTALAN-VANNASI-KISI",
          mark: "Нм",
          mode: "2",
          qty: 3,
          fillsRestDays: false,
        },
      ],
      kept: [
        {
          ymd: "2026-10-05",
          procedureCode: "SVC-NAFTALAN-VANNASI-KISI",
          locked: true,
        },
      ],
      layout: "fresh",
      notBeforeYmd: "2026-10-08",
    });
    expect(cells.map((cell) => cell.ymd)).toEqual([
      "2026-10-05",
      "2026-10-08",
      "2026-10-09",
    ]);
  });

  it("keeps every past pin even when qty is already spent", () => {
    const cells = planBathSeries({
      days: week(),
      series: [
        {
          seriesCode: "NAFTALAN",
          procedureCode: "SVC-NAFTALAN-VANNASI-KISI",
          mark: "Нм",
          mode: "2",
          qty: 1,
          fillsRestDays: false,
        },
      ],
      kept: [
        {
          ymd: "2026-10-05",
          procedureCode: "SVC-NAFTALAN-VANNASI-KISI",
          locked: true,
        },
        {
          ymd: "2026-10-06",
          procedureCode: "SVC-NAFTALAN-VANNASI-KISI",
          locked: true,
        },
      ],
      layout: "fresh",
      notBeforeYmd: "2026-10-08",
    });
    expect(cells.map((cell) => cell.ymd)).toEqual(["2026-10-05", "2026-10-06"]);
  });
});

describe("strayBathOrderIds", () => {
  it("drops the day that was saved beside the package, and keeps a checked-in one", () => {
    const ids = strayBathOrderIds([
      {
        id: "pkg",
        procedureCode: "SVC-NAFTALAN-VANNASI-KISI",
        packageQuotaCode: "NAFTALAN_BATH",
        status: "SCHEDULED",
      },
      {
        id: "extra",
        procedureCode: "SVC-NAFTALAN-VANNASI-KISI",
        packageQuotaCode: "SVC-NAFTALAN-VANNASI-KISI",
        status: "SCHEDULED",
      },
      {
        id: "blank",
        procedureCode: "SVC-NAFTALAN-VANNASI-KISI",
        packageQuotaCode: null,
        status: "SCHEDULED",
      },
      {
        id: "done",
        procedureCode: "SVC-NAFTALAN-VANNASI-KISI",
        packageQuotaCode: "SVC-NAFTALAN-VANNASI-KISI",
        status: "CHECKED_IN",
      },
    ]);
    expect(ids).toEqual(["extra"]);
  });
});
