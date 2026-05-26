import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@erafinance/database";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { OrganizationId } from "../../common/org-id.decorator";
import { RecordGrantReceiptDto } from "./dto/record-grant-receipt.dto";
import { GrantReceiptService } from "./grant-receipt.service";

@ApiTags("accounting-grants")
@ApiBearerAuth("bearer")
@Controller("accounting/grant-receipts")
@UseGuards(JwtAuthGuard, RolesGuard)
export class GrantReceiptController {
  constructor(private readonly grants: GrantReceiptService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT)
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
