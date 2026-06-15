import { Injectable } from "@nestjs/common";
import { DataHubClientService } from "../data-hub/data-hub-client.service";

function fallbackIsWorkingDay(isoDate: string): boolean {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00.000Z`);
  const dow = d.getUTCDay();
  return dow !== 0 && dow !== 6;
}

@Injectable()
export class HrCalendarService {
  constructor(private readonly dataHub: DataHubClientService) {}

  async isWorkingDay(isoDate: string): Promise<boolean> {
    if (this.dataHub.isEnabled()) {
      const remote = await this.dataHub.isWorkingDay(isoDate, "az");
      if (remote !== null) return remote;
    }
    return fallbackIsWorkingDay(isoDate);
  }

  async getDay(isoDate: string) {
    if (this.dataHub.isEnabled()) {
      const remote = await this.dataHub.getCalendarDay(isoDate, "az");
      if (remote) return remote;
    }
    const working = fallbackIsWorkingDay(isoDate);
    return {
      isWorking: working,
      dayType: working ? "working" : "weekend",
    };
  }

  async countWorkingDaysInMonth(year: number, month1to12: number): Promise<number> {
    const lastDay = new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
    let n = 0;
    for (let d = 1; d <= lastDay; d++) {
      const iso = `${year}-${String(month1to12).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (await this.isWorkingDay(iso)) n += 1;
    }
    return n;
  }

  async addBusinessDays(isoDate: string, n: number): Promise<string> {
    if (this.dataHub.isEnabled()) {
      const remote = await this.dataHub.addBusinessDays(isoDate, n, "az");
      if (remote) return remote;
    }
    let cursor = new Date(`${isoDate.slice(0, 10)}T12:00:00.000Z`);
    let added = 0;
    while (added < n) {
      cursor = new Date(cursor.getTime() + 86400000);
      const iso = cursor.toISOString().slice(0, 10);
      if (await this.isWorkingDay(iso)) added++;
    }
    return cursor.toISOString().slice(0, 10);
  }
}
