import { CP_PERMISSION } from "../auth/cp-permissions";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SuperAdminGuard } from "../common/guards/super-admin.guard";
import { UpsertOrgPaymentMethodDto } from "./dto/upsert-org-payment-method.dto";
import { OrgPaymentMethodService } from "./org-payment-method.service";

@UseGuards(JwtAuthGuard, SuperAdminGuard, PermissionsGuard)
@RequirePermissions(CP_PERMISSION.ADMIN_PLATFORM)
@Controller("v1/admin/orgs/:orgId/payment-methods")
export class OrgPaymentMethodController {
  constructor(private readonly service: OrgPaymentMethodService) {}

  @Get()
  list(@Param("orgId", ParseUUIDPipe) orgId: string) {
    return this.service.list(orgId);
  }

  @Post()
  create(
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body() body: UpsertOrgPaymentMethodDto,
  ) {
    return this.service.create(orgId, body);
  }

  @Put(":methodId")
  update(
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("methodId", ParseUUIDPipe) methodId: string,
    @Body() body: UpsertOrgPaymentMethodDto,
  ) {
    return this.service.update(orgId, methodId, body);
  }

  @Delete(":methodId")
  deactivate(
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("methodId", ParseUUIDPipe) methodId: string,
  ) {
    return this.service.deactivate(orgId, methodId);
  }
}
