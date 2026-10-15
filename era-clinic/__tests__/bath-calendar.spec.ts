import { planBathSeries, type StayDay } from "@/domain/planning/bath-calendar";

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

  it("treats a closed day inside a streak as the rest", () => {
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
});
