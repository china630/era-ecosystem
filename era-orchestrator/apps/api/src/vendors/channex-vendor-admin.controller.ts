import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { IsBoolean, IsOptional, IsString, ValidateIf } from "class-validator";
import { CP_PERMISSION } from "../auth/cp-permissions";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { SuperAdminGuard } from "../common/guards/super-admin.guard";
import { ChannexVendorService } from "./channex-vendor.service";

class UpsertChannexVendorDto {
  @IsOptional()
  @IsString()
  apiBase?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  apiKey?: string | null;

  @IsOptional()
  @IsBoolean()
  useProductionBase?: boolean;

  @IsOptional()
  @IsBoolean()
  pmsCertified?: boolean;
}

@UseGuards(JwtAuthGuard, SuperAdminGuard, PermissionsGuard)
@RequirePermissions(CP_PERMISSION.ADMIN_PLATFORM)
@Controller("v1/admin/vendors/channex")
export class ChannexVendorAdminController {
  constructor(private readonly channex: ChannexVendorService) {}

  @Get()
  getPublic() {
    return this.channex.getPublic();
  }

  @Put()
  upsert(@Body() body: UpsertChannexVendorDto) {
    return this.channex.upsert(body);
  }
}
