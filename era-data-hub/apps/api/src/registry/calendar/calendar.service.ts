import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { DataSourceService } from "../../prisma/data-source.service";
import { registryMeta } from "../../common/registry-meta";

function parseDate(raw: string): Date {
  const d = new Date(`${raw.slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException({ code: "INVALID_DATE", message: `Invalid date: ${raw}` });
  }
  return d;
}

@Injectable()
export class CalendarService {
  constructor(private readonly ds: DataSourceService) {}

  async isWorkingDay(country: string, dateRaw: string) {
    const date = parseDate(dateRaw);
    const row = await this.ds.hubDb().calendarDay.findUnique({
      where: { country_date: { country: country.toUpperCase(), date } },
    });
    if (!row) {
      throw new NotFoundException({
        code: "CALENDAR_DAY_NOT_FOUND",
        message: `No calendar row for ${country} ${dateRaw.slice(0, 10)}`,
      });
    }
    return {
      meta: registryMeta("calendar_days", dateRaw.slice(0, 10)),
      country: row.country,
      date: dateRaw.slice(0, 10),
      isWorking: row.isWorking,
      dayType: row.dayType,
    };
  }

  async addBusinessDays(country: string, dateRaw: string, nRaw: string) {
    const n = Number.parseInt(nRaw, 10);
    if (!Number.isFinite(n) || n < 0) {
      throw new BadRequestException({ code: "INVALID_N", message: "n must be a non-negative integer" });
    }
    let cursor = parseDate(dateRaw);
    let added = 0;
    const c = country.toUpperCase();
    const hub = this.ds.hubDb();
    while (added < n) {
      cursor = new Date(cursor.getTime() + 86400000);
      const row = await hub.calendarDay.findUnique({
        where: { country_date: { country: c, date: cursor } },
      });
      if (row?.isWorking) added++;
      if (cursor.getUTCFullYear() > 2030) {
        throw new BadRequestException({ code: "RANGE_EXCEEDED", message: "Could not resolve business days" });
      }
    }
    return {
      meta: registryMeta("calendar_days", cursor.toISOString().slice(0, 10)),
      country: c,
      startDate: dateRaw.slice(0, 10),
      businessDaysAdded: n,
      resultDate: cursor.toISOString().slice(0, 10),
    };
  }
}
