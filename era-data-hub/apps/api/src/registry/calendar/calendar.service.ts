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

function toDayDto(
  row: {
    country: string;
    date: Date;
    isWorking: boolean;
    dayType: string;
    labelAz: string | null;
    labelRu: string | null;
    labelEn: string | null;
  },
  dateRaw: string,
) {
  return {
    country: row.country,
    date: dateRaw.slice(0, 10),
    isWorking: row.isWorking,
    dayType: row.dayType,
    labelAz: row.labelAz,
    labelRu: row.labelRu,
    labelEn: row.labelEn,
  };
}

@Injectable()
export class CalendarService {
  constructor(private readonly ds: DataSourceService) {}

  private async findRow(country: string, dateRaw: string) {
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
    return row;
  }

  async getDay(country: string, dateRaw: string) {
    const row = await this.findRow(country, dateRaw);
    return {
      meta: registryMeta("calendar_days", dateRaw.slice(0, 10)),
      ...toDayDto(row, dateRaw),
    };
  }

  async isWorkingDay(country: string, dateRaw: string) {
    const row = await this.findRow(country, dateRaw);
    return {
      meta: registryMeta("calendar_days", dateRaw.slice(0, 10)),
      ...toDayDto(row, dateRaw),
    };
  }

  async getDaysRange(country: string, fromRaw: string, toRaw: string) {
    const from = parseDate(fromRaw);
    const to = parseDate(toRaw);
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException({ code: "INVALID_RANGE", message: "from must be <= to" });
    }
    const c = country.toUpperCase();
    const rows = await this.ds.hubDb().calendarDay.findMany({
      where: { country: c, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
    });
    return {
      meta: registryMeta("calendar_days", `${fromRaw.slice(0, 10)}..${toRaw.slice(0, 10)}`),
      country: c,
      from: fromRaw.slice(0, 10),
      to: toRaw.slice(0, 10),
      days: rows.map((row) =>
        toDayDto(row, row.date.toISOString().slice(0, 10)),
      ),
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
