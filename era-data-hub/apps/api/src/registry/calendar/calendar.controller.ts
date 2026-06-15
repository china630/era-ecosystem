import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { RegistryAuthGuard } from "../../auth/registry-auth.guard";
import { CalendarService } from "./calendar.service";

@ApiTags("calendar")
@ApiSecurity("api-key")
@ApiSecurity("service-token")
@UseGuards(RegistryAuthGuard)
@Controller("calendar")
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get(":country/day")
  @ApiOperation({ summary: "Single calendar day with dayType and labels" })
  getDay(@Param("country") country: string, @Query("date") date: string) {
    return this.calendar.getDay(country, date);
  }

  @Get(":country/days")
  @ApiOperation({ summary: "Bulk calendar days for cache warm-up" })
  getDays(
    @Param("country") country: string,
    @Query("from") from: string,
    @Query("to") to: string,
  ) {
    return this.calendar.getDaysRange(country, from, to);
  }

  @Get(":country/is-working-day")
  @ApiOperation({ summary: "Working day check (alias of /day)" })
  isWorking(@Param("country") country: string, @Query("date") date: string) {
    return this.calendar.isWorkingDay(country, date);
  }

  @Get(":country/add-business-days")
  addBusiness(
    @Param("country") country: string,
    @Query("date") date: string,
    @Query("n") n: string,
  ) {
    return this.calendar.addBusinessDays(country, date, n);
  }
}
