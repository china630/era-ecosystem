import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { OrganizationId } from "../common/org-id.decorator";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { MgmtLaborDeltaService } from "./mgmt-labor-delta.service";

@ApiTags("hr-mgmt-labor-delta")
@ApiBearerAuth("bearer")
@RequiresModule(ModuleEntitlement.HR_FULL)
@UseGuards(SubscriptionGuard)
@Controller("hr/mgmt-labor-delta")
export class MgmtLaborDeltaController {
  constructor(private readonly deltas: MgmtLaborDeltaService) {}

  @Post("rebuild")
  @Permissions(CP_PERMISSION.API_BOOK_MGMT)
  @ApiOperation({
    summary:
      "Rebuild MGMT labor cost deltas after timesheet APPROVED (no pay / XML)",
  })
  rebuild(
    @OrganizationId() organizationId: string,
    @Query("year") yearRaw: string,
    @Query("month") monthRaw: string,
  ) {
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    return this.deltas.rebuild(organizationId, year, month);
  }

  @Get()
  @Permissions(CP_PERMISSION.API_BOOK_MGMT)
  @ApiOperation({ summary: "List MGMT labor deltas for a month" })
  list(
    @OrganizationId() organizationId: string,
    @Query("year") yearRaw: string,
    @Query("month") monthRaw: string,
  ) {
    return this.deltas.list(organizationId, Number(yearRaw), Number(monthRaw));
  }
}
