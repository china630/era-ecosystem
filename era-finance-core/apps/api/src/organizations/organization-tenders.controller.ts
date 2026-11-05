import { Permissions } from "../common/decorators/permissions.decorator";
import { Controller, Get, GoneException, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { TENDER_SEED_ROWS, CP_PERMISSION } from "@era/contracts";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OrganizationId } from "../common/org-id.decorator";

/**
 * Read-only seed snapshot for ledger mapping.
 * Org payment method catalog SoR is orchestrator (org card + Sync).
 */
@ApiTags("organization-tenders")
@ApiBearerAuth("bearer")
@Controller("organization/tenders")
@UseGuards(JwtAuthGuard)
export class OrganizationTendersController {
  @Get()
  @Permissions(CP_PERMISSION.API_LEDGER_READ)
  @ApiOperation({
    summary:
      "Legacy seed tender rows (read-only). Edit methods on the orchestrator org card.",
  })
  async list(@OrganizationId() _organizationId: string) {
    return {
      tenders: TENDER_SEED_ROWS,
      enabledCodes: TENDER_SEED_ROWS.filter((r) => r.active).map((r) => r.code),
      sourceOfRecord: "orchestrator-org-payment-methods",
    };
  }

  @Put()
  @Permissions(CP_PERMISSION.ADMIN_ORG_SETTINGS)
  @ApiOperation({
    summary: "Removed — payment methods are edited on the orchestrator org card",
  })
  put() {
    throw new GoneException(
      "Payment methods are edited on the orchestrator organization card (KKM / payment methods). Finance only reads the tender code.",
    );
  }
}
