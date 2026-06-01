import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard";
import { PrismaService } from "../../prisma/prisma.service";

@ApiTags("admin-platform-notifications")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller("v1/admin/platform/notifications")
export class AdminNotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("templates")
  @ApiOperation({ summary: "List notification templates (Super-Admin)" })
  listTemplates() {
    return this.prisma.notificationTemplate.findMany({
      orderBy: [{ templateKey: "asc" }, { channel: "asc" }],
    });
  }
}
