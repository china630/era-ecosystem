import {
  nextWorkingYmd,
  notBeforeYmdFromStart,
  saxlaFirstClock,
  saxlaRepeatClock,
  type ClinicDay,
} from "@/domain/planning/clinic-day";
import { bakuDateKey, bakuHourMinute, parseBakuDateTime } from "@/lib/baku-day";

function day(ymd: string, working: boolean): ClinicDay {
  return { ymd, working, endHour: working ? 17 : 0 };
}

describe("nextWorkingYmd", () => {
  const week = [
    day("2026-10-17", true),
    day("2026-10-18", false),
    day("2026-10-19", true),
  ];

  it("leaves an already working day", () => {
    expect(nextWorkingYmd(week, "2026-10-17")).toBe("2026-10-17");
  });

  it("moves Sunday to Monday", () => {
    expect(nextWorkingYmd(week, "2026-10-18")).toBe("2026-10-19");
  });

  it("returns null when the stay has no later working day", () => {
    expect(nextWorkingYmd([day("2026-10-18", false)], "2026-10-18")).toBeNull();
  });
});

describe("notBeforeYmdFromStart", () => {
  it("uses today when Saxla has no start clock", () => {
    expect(notBeforeYmdFromStart(null, "2026-10-19")).toBe("2026-10-19");
  });

  it("uses the Saxla start day when it is today or later", () => {
    expect(notBeforeYmdFromStart(parseBakuDateTime("2026-10-19", "10:00"), "2026-10-19")).toBe(
      "2026-10-19",
    );
    expect(notBeforeYmdFromStart(parseBakuDateTime("2026-10-20", "09:00"), "2026-10-19")).toBe(
      "2026-10-20",
    );
  });

  it("does not start in the past", () => {
    expect(notBeforeYmdFromStart(parseBakuDateTime("2026-10-18", "10:00"), "2026-10-19")).toBe(
      "2026-10-19",
    );
  });
});

describe("saxlaRepeatClock", () => {
  const now = parseBakuDateTime("2026-11-02", "12:26");

  it("stays on the remembered hour while now is earlier", () => {
    const clock = saxlaRepeatClock({ now, rememberedHour: 13, dayStartHour: 9, dayEndHour: 17 });
    expect(bakuDateKey(clock)).toBe("2026-11-02");
    expect(bakuHourMinute(clock).hour).toBe(13);
  });

  it("uses the current hour once the remembered hour has passed", () => {
    const later = parseBakuDateTime("2026-11-02", "15:10");
    const clock = saxlaRepeatClock({ now: later, rememberedHour: 13, dayStartHour: 9, dayEndHour: 17 });
    expect(bakuHourMinute(clock).hour).toBe(15);
  });

  it("does not reopen the morning when nothing was remembered", () => {
    const clock = saxlaRepeatClock({ now, rememberedHour: null, dayStartHour: 9, dayEndHour: 17 });
    expect(bakuHourMinute(clock).hour).toBe(12);
  });
});

describe("saxlaFirstClock", () => {
  it("keeps the Saxla instant when the first pin is that day", () => {
    const start = parseBakuDateTime("2026-10-19", "11:00");
    expect(saxlaFirstClock(start, "2026-10-19", 9).getTime()).toBe(start.getTime());
  });

  it("moves the Saxla hour onto the first working pin day", () => {
    const clock = saxlaFirstClock(parseBakuDateTime("2026-10-18", "11:00"), "2026-10-19", 9);
    expect(bakuDateKey(clock)).toBe("2026-10-19");
    expect(bakuHourMinute(clock).hour).toBe(11);
  });
});
