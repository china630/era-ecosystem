import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { RegistryAuthGuard } from "../../auth/registry-auth.guard";
import { CompaniesService } from "./companies.service";

@ApiTags("companies")
@ApiSecurity("api-key")
@ApiSecurity("service-token")
@UseGuards(RegistryAuthGuard)
@Controller("companies")
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get(":voen")
  @ApiOperation({ summary: "Company requisites by VÖEN (PII masked for external by default)" })
  get(
    @Param("voen") voen: string,
    @Query("maskPii") maskPii?: string,
  ) {
    const mask =
      maskPii === undefined ? undefined : maskPii === "true" || maskPii === "1";
    return this.companies.getByVoen(voen, mask);
  }
}
