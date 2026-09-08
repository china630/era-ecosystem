import {
  getClosedPeriodKeys,
  getClosedYearKeys,
  getLockedPeriodUntil,
  mergeClosedPeriod,
  mergeClosedYear,
  mergeLockedPeriodUntil,
  unmergeClosedPeriod,
  unmergeClosedYear,
  areAllMonthsClosed,
} from "../../src/reporting/reporting-period.util";

describe("per-book period close (P1)", () => {
  it("legacy closedPeriods applies only to NAS", () => {
    const settings = { reporting: { closedPeriods: ["2026-01"] } };
    expect(getClosedPeriodKeys(settings, "NAS")).toEqual(["2026-01"]);
    expect(getClosedPeriodKeys(settings, "IFRS")).toEqual([]);
  });

  it("closedPeriodsByLedger isolates NAS vs IFRS", () => {
    const settings = {
      reporting: {
        closedPeriodsByLedger: {
          NAS: ["2026-01"],
          IFRS: ["2026-02"],
        },
      },
    };
    expect(getClosedPeriodKeys(settings, "NAS")).toEqual(["2026-01"]);
    expect(getClosedPeriodKeys(settings, "IFRS")).toEqual(["2026-02"]);
  });

  it("mergeClosedPeriod IFRS does not write legacy NAS list", () => {
    const next = mergeClosedPeriod({}, "2026-03", "IFRS");
    const rep = (next.reporting as Record<string, unknown>) ?? {};
    expect(rep.closedPeriods).toBeUndefined();
    expect(
      (rep.closedPeriodsByLedger as Record<string, string[]>).IFRS,
    ).toContain("2026-03");
  });

  it("mergeClosedPeriod NAS syncs legacy flat list", () => {
    const next = mergeClosedPeriod({}, "2026-04", "NAS");
    const rep = next.reporting as Record<string, unknown>;
    expect(rep.closedPeriods).toEqual(["2026-04"]);
    expect(
      (rep.closedPeriodsByLedger as Record<string, string[]>).NAS,
    ).toContain("2026-04");
  });

  it("unmergeClosedPeriod removes key per ledger", () => {
    const closed = mergeClosedPeriod(
      mergeClosedPeriod({}, "2026-03", "IFRS"),
      "2026-03",
      "NAS",
    );
    const reopened = unmergeClosedPeriod(closed, "2026-03", "IFRS");
    expect(getClosedPeriodKeys(reopened, "IFRS")).toEqual([]);
    expect(getClosedPeriodKeys(reopened, "NAS")).toEqual(["2026-03"]);
  });

  it("lockedPeriodUntil legacy is NAS-only", () => {
    const settings = { ledger: { lockedPeriodUntil: "2026-01-31" } };
    expect(getLockedPeriodUntil(settings, "NAS")?.toISOString().slice(0, 10)).toBe(
      "2026-01-31",
    );
    expect(getLockedPeriodUntil(settings, "IFRS")).toBeNull();
  });

  it("mergeLockedPeriodUntil writes ByLedger for IFRS", () => {
    const next = mergeLockedPeriodUntil({}, "2026-02-28", "IFRS");
    const ledger = next.ledger as Record<string, unknown>;
    expect(ledger.lockedPeriodUntil).toBeUndefined();
    expect(
      (ledger.lockedPeriodUntilByLedger as Record<string, string>).IFRS,
    ).toBe("2026-02-28");
    expect(getLockedPeriodUntil(next, "IFRS")?.toISOString().slice(0, 10)).toBe(
      "2026-02-28",
    );
  });

  it("dual-writes and reads a lock by active accounting book", () => {
    const bookId = "book-management-1";
    const next = mergeLockedPeriodUntil(
      {},
      "2026-04-30",
      "MANAGEMENT",
      bookId,
    );
    const ledger = next.ledger as Record<string, unknown>;
    expect(
      (ledger.lockedPeriodUntilByLedger as Record<string, string>).MANAGEMENT,
    ).toBe("2026-04-30");
    expect(
      (ledger.lockedPeriodUntilByBookId as Record<string, string>)[bookId],
    ).toBe("2026-04-30");
    expect(
      getLockedPeriodUntil(next, "MANAGEMENT", bookId)
        ?.toISOString()
        .slice(0, 10),
    ).toBe("2026-04-30");
  });

  it("dual-writes closedPeriodsByBookId when bookId provided", () => {
    const bookId = "book-nas-1";
    const next = mergeClosedPeriod({}, "2026-05", "NAS", bookId);
    const rep = next.reporting as Record<string, unknown>;
    expect(
      (rep.closedPeriodsByBookId as Record<string, string[]>)[bookId],
    ).toEqual(["2026-05"]);
    expect(getClosedPeriodKeys(next, "NAS", bookId)).toEqual(["2026-05"]);
    const reopened = unmergeClosedPeriod(next, "2026-05", "NAS", bookId);
    expect(getClosedPeriodKeys(reopened, "NAS", bookId)).toEqual([]);
  });

  it("isolates two MANAGEMENT books with the same ledger type", () => {
    const first = mergeClosedPeriod(
      {},
      "2026-06",
      "MANAGEMENT",
      "book-management-a",
    );
    const second = mergeClosedPeriod(
      first,
      "2026-07",
      "MANAGEMENT",
      "book-management-b",
    );

    expect(
      getClosedPeriodKeys(second, "MANAGEMENT", "book-management-a"),
    ).toEqual(["2026-06"]);
    expect(
      getClosedPeriodKeys(second, "MANAGEMENT", "book-management-b"),
    ).toEqual(["2026-07"]);
  });

  it("closedYearsByBookId isolates fiscal years per book", () => {
    const first = mergeClosedYear({}, 2025, "book-nas", true);
    expect(getClosedYearKeys(first, "book-nas")).toEqual([2025]);
    expect(getClosedYearKeys(first)).toEqual([2025]);

    const second = mergeClosedYear(first, 2024, "book-mgmt", false);
    expect(getClosedYearKeys(second, "book-nas")).toEqual([2025]);
    expect(getClosedYearKeys(second, "book-mgmt")).toEqual([2024]);
    expect(getClosedYearKeys(second)).toEqual([2025]);

    const reopened = unmergeClosedYear(second, 2025, "book-nas", true);
    expect(getClosedYearKeys(reopened, "book-nas")).toEqual([]);
    expect(getClosedYearKeys(reopened, "book-mgmt")).toEqual([2024]);
  });

  it("areAllMonthsClosed respects book scope", () => {
    const settings = {
      reporting: {
        closedPeriodsByBookId: {
          "book-a": [
            "2025-01",
            "2025-02",
            "2025-03",
            "2025-04",
            "2025-05",
            "2025-06",
            "2025-07",
            "2025-08",
            "2025-09",
            "2025-10",
            "2025-11",
            "2025-12",
          ],
        },
      },
    };
    expect(areAllMonthsClosed(settings, 2025, "NAS", "book-a")).toBe(true);
    expect(areAllMonthsClosed(settings, 2025, "NAS", "book-b")).toBe(false);
  });
});
