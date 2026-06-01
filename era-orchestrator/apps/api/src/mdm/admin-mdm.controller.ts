import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../common/guards/super-admin.guard";
import { MdmService } from "./mdm.service";

@ApiTags("admin")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller("v1/admin/mdm")
export class AdminMdmController {
  constructor(private readonly mdm: MdmService) {}

  @Get("companies")
  @ApiOperation({ summary: "Paginated global legal entities (super-admin)" })
  listCompanies(
    @Query("page") pageRaw?: string,
    @Query("pageSize") pageSizeRaw?: string,
  ) {
    const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(pageSizeRaw ?? "25", 10) || 25),
    );
    return this.mdm.listLegalEntities({ page, pageSize });
  }

  @Get("health")
  health() {
    return this.mdm.healthCheck();
  }
}
