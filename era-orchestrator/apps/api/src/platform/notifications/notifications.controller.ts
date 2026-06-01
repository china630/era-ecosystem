import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { NotificationOutboxStatus } from "@era365/database";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { OrganizationId } from "../../common/org-id.decorator";
import { SendNotificationDto } from "./dto/send-notification.dto";
import { NotificationsService } from "./notifications.service";

@ApiTags("platform-notifications")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard)
@Controller("platform/notifications/v1")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post("send")
  @ApiOperation({
    summary:
      "Enqueue and send a transactional notification (idempotent per org + source + template)",
  })
  async send(
    @OrganizationId() organizationId: string,
    @Body() dto: SendNotificationDto,
  ) {
    return this.notifications.send(organizationId, dto);
  }

  @Get("outbox")
  @ApiOperation({ summary: "List notification outbox entries for the org" })
  async listOutbox(
    @OrganizationId() organizationId: string,
    @Query("status", new ParseEnumPipe(NotificationOutboxStatus, { optional: true }))
    status?: NotificationOutboxStatus,
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query("offset", new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ) {
    return this.notifications.listOutbox(organizationId, { status, limit, offset });
  }

  @Get("outbox/:id")
  @ApiOperation({ summary: "Get a single outbox entry with delivery logs" })
  async getOutboxEntry(
    @OrganizationId() organizationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.notifications.getOutboxEntry(organizationId, id);
  }
}
