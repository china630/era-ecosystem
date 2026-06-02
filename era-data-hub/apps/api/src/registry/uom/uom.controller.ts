import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { RegistryAuthGuard } from "../../auth/registry-auth.guard";
import { UomService } from "./uom.service";

@ApiTags("uom")
@ApiSecurity("api-key")
@ApiSecurity("service-token")
@UseGuards(RegistryAuthGuard)
@Controller("uom")
export class UomController {
  constructor(private readonly uom: UomService) {}

  @Get()
  list() {
    return this.uom.list();
  }
}
