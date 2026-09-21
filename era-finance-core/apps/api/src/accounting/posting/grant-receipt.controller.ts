import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { OrganizationId } from "../../common/org-id.decorator";
import { RecordGrantReceiptDto } from "./dto/record-grant-receipt.dto";
import { GrantReceiptService } from "./grant-receipt.service";

@ApiTags("accounting-grants")
@ApiBearerAuth("bearer")
@Controller("accounting/grant-receipts")
@UseGuards(JwtAuthGuard)
export class GrantReceiptController {
  constructor(private readonly grants: GrantReceiptService) {}

  @Post()
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({
    summary: "Record NGO grant / targeted funding (NGO_GRANT_INCOME schema)",
  })
  record(
    @OrganizationId() organizationId: string,
    @Body() dto: RecordGrantReceiptDto,
  ) {
    return this.grants.record(organizationId, dto);
  }
}
