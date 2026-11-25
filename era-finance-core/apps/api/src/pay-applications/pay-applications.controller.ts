import { CP_PERMISSION } from "@era/contracts";
import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Header,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Permissions } from "../common/decorators/permissions.decorator";
import { OrganizationId } from "../common/org-id.decorator";
import { RequiresModule } from "../subscription/requires-module.decorator";
import { SubscriptionGuard } from "../subscription/subscription.guard";
import { ModuleEntitlement } from "../subscription/subscription.constants";
import { CreatePayApplicationDto } from "./dto/pay-application.dto";
import { PayApplicationsService } from "./pay-applications.service";

@ApiTags("pay-applications")
@ApiBearerAuth("bearer")
@Controller("pay-applications")
@UseGuards(SubscriptionGuard)
@RequiresModule(ModuleEntitlement.CONTRACT_PAYAPP_KS)
export class PayApplicationsController {
  constructor(private readonly payApps: PayApplicationsService) {}

  @Get()
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @ApiOperation({ summary: "List pay applications" })
  list(
    @OrganizationId() organizationId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("pageSize", new DefaultValuePipe(25), ParseIntPipe) pageSize: number,
  ) {
    return this.payApps.list(organizationId, { page, pageSize });
  }

  @Post()
  @Permissions(CP_PERMISSION.API_LEDGER_PERIOD_CLOSE)
  @ApiOperation({ summary: "Create pay application" })
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: CreatePayApplicationDto,
  ) {
    return this.payApps.create(organizationId, dto);
  }

  @Get(":id")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  get(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.payApps.get(organizationId, id);
  }

  @Post(":id/submit")
  @Permissions(CP_PERMISSION.API_LEDGER_PERIOD_CLOSE)
  submit(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.payApps.submit(organizationId, id);
  }

  @Post(":id/approve")
  @Permissions(CP_PERMISSION.API_LEDGER_PERIOD_CLOSE)
  approve(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.payApps.approve(organizationId, id);
  }

  @Post(":id/post")
  @Permissions(CP_PERMISSION.API_LEDGER_PERIOD_CLOSE)
  post(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.payApps.post(organizationId, id);
  }

  @Get(":id/print-snapshot")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  printSnapshot(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
  ) {
    return this.payApps.getPrintSnapshot(organizationId, id);
  }

  @Get(":id/print-html")
  @Permissions(CP_PERMISSION.API_LEDGER_POST)
  @Header("Content-Type", "text/html; charset=utf-8")
  printHtml(
    @OrganizationId() organizationId: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Query("kind") kind?: string,
  ) {
    const k = kind === "ks3" ? "ks3" : "ks2";
    return this.payApps.getPrintHtml(organizationId, id, k);
  }
}
