import { Injectable } from "@nestjs/common";
import { DataHubClientService } from "../data-hub/data-hub-client.service";
import { isAzWorkingDay } from "./calendar/az-2026";

@Injectable()
export class HrCalendarService {
  constructor(private readonly dataHub: DataHubClientService) {}

  async isWorkingDay(isoDate: string): Promise<boolean> {
    if (this.dataHub.isEnabled()) {
      const remote = await this.dataHub.isWorkingDay(isoDate, "az");
      if (remote !== null) return remote;
    }
    const [y, m, d] = isoDate.split("-").map(Number);
    return isAzWorkingDay(y, m - 1, d);
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
}
