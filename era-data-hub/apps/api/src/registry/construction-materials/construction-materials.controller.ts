import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { RegistryAuthGuard } from "../../auth/registry-auth.guard";
import { ConstructionMaterialsService } from "./construction-materials.service";

@ApiTags("construction-materials")
@ApiSecurity("api-key")
@ApiSecurity("service-token")
@UseGuards(RegistryAuthGuard)
@Controller("construction/materials")
export class ConstructionMaterialsController {
  constructor(private readonly materials: ConstructionMaterialsService) {}

  @Get()
  @ApiOperation({ summary: "List construction materials nomenclature" })
  list(@Query("q") q?: string) {
    return this.materials.list(q);
  }

  @Get(":code")
  @ApiOperation({ summary: "Get construction material by code" })
  getByCode(@Param("code") code: string) {
    return this.materials.getByCode(code);
  }
}
