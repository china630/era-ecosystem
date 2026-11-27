import { CP_PERMISSION } from "../auth/cp-permissions";
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SuperAdminGuard } from "../common/guards/super-admin.guard";
import { SystemConfigService } from "../system-config/system-config.service";
import { IsDefined } from "class-validator";

class PutSystemConfigDto {
  @IsDefined()
  value!: unknown;
}

@UseGuards(JwtAuthGuard, SuperAdminGuard, PermissionsGuard)
@RequirePermissions(CP_PERMISSION.ADMIN_PLATFORM)
@Controller("v1/admin/system-config")
export class AdminSystemConfigController {
  constructor(private readonly systemConfig: SystemConfigService) {}

  @Get()
  list() {
    return this.systemConfig.listAdminSystemConfigRows();
  }

  @Put(":key")
  async put(@Param("key") key: string, @Body() dto: PutSystemConfigDto) {
    await this.systemConfig.putAdminSystemConfig(
      decodeURIComponent(key),
      dto.value,
    );
    return { ok: true as const };
  }

  @Post(":key/reset")
  async reset(@Param("key") key: string) {
    await this.systemConfig.resetAdminSystemConfig(decodeURIComponent(key));
    return { ok: true as const };
  }
}
