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
import { UpsertFiscalHardwareDeviceDto } from "./dto/upsert-fiscal-hardware-device.dto";
import { FiscalHardwareDeviceService } from "./fiscal-hardware-device.service";

@UseGuards(JwtAuthGuard, SuperAdminGuard, PermissionsGuard)
@RequirePermissions(CP_PERMISSION.ADMIN_PLATFORM)
@Controller("v1/admin/orgs/:orgId/fiscal-devices")
export class FiscalHardwareDeviceController {
  constructor(private readonly service: FiscalHardwareDeviceService) {}

  @Get()
  list(@Param("orgId", ParseUUIDPipe) orgId: string) {
    return this.service.list(orgId);
  }

  @Post()
  create(
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Body() body: UpsertFiscalHardwareDeviceDto,
  ) {
    return this.service.create(orgId, body);
  }

  @Put(":deviceId")
  update(
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("deviceId", ParseUUIDPipe) deviceId: string,
    @Body() body: UpsertFiscalHardwareDeviceDto,
  ) {
    return this.service.update(orgId, deviceId, body);
  }

  @Delete(":deviceId")
  retire(
    @Param("orgId", ParseUUIDPipe) orgId: string,
    @Param("deviceId", ParseUUIDPipe) deviceId: string,
  ) {
    return this.service.retire(orgId, deviceId);
  }
}
