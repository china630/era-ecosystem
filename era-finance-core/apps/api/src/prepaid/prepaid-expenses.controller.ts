import { CP_PERMISSION } from "@era/contracts";
import { Permissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { OrganizationId } from "../common/org-id.decorator";
import { CreatePrepaidExpenseDto } from "./dto/create-prepaid-expense.dto";
import { PrepaidExpensesService } from "./prepaid-expenses.service";

@ApiTags("prepaid-expenses")
@ApiBearerAuth("bearer")
@Controller("prepaid-expenses")
@UseGuards(PermissionsGuard)
export class PrepaidExpensesController {
  constructor(private readonly prepaid: PrepaidExpensesService) {}

  @Get()
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "List prepaid expenses for the organization" })
  list(@OrganizationId() orgId: string) {
    return this.prepaid.list(orgId);
  }

  @Post()
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "Create prepaid expense and generate monthly schedule" })
  create(@OrganizationId() orgId: string, @Body() dto: CreatePrepaidExpenseDto) {
    return this.prepaid.create(orgId, dto);
  }

  @Post(":id/post-month")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({
    summary: "Post amortization for a schedule period (Dr expense / Cr prepaid)",
  })
  postMonth(
    @OrganizationId() orgId: string,
    @Param("id") id: string,
    @Query("period") period: string,
  ) {
    if (!period?.trim()) {
      throw new BadRequestException("period query (YYYY-MM) is required");
    }
    return this.prepaid.postMonth({
      organizationId: orgId,
      prepaidExpenseId: id,
      period: period ?? "",
    });
  }
}
