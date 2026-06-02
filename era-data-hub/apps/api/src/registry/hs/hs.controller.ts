import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { RegistryAuthGuard } from "../../auth/registry-auth.guard";
import { HsService } from "./hs.service";

@ApiTags("hs")
@ApiSecurity("api-key")
@ApiSecurity("service-token")
@UseGuards(RegistryAuthGuard)
@Controller("hs")
export class HsController {
  constructor(private readonly hs: HsService) {}

  @Get(":code")
  @ApiOperation({ summary: "HS code metadata (latest catalog row)" })
  code(@Param("code") code: string) {
    return this.hs.getHs(code);
  }

  @Get(":code/tariff")
  @ApiOperation({ summary: "Tariff rates effective on date" })
  tariff(@Param("code") code: string, @Query("date") date?: string) {
    return this.hs.getTariff(code, date);
  }
}
