import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { RegistryAuthGuard } from "../../auth/registry-auth.guard";
import { BanksService } from "./banks.service";

@ApiTags("banks")
@ApiSecurity("api-key")
@ApiSecurity("service-token")
@UseGuards(RegistryAuthGuard)
@Controller("banks")
export class BanksController {
  constructor(private readonly banks: BanksService) {}

  @Get()
  @ApiOperation({ summary: "List active banks" })
  list() {
    return this.banks.listBanks();
  }

  @Get("branches/:code")
  @ApiOperation({ summary: "Branch by MFO/branch code" })
  branch(@Param("code") code: string) {
    return this.banks.getBranch(code);
  }
}
