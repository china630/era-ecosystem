import { Body, Controller, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { NotificationOutboxStatus } from "@era365/database";
import { Public } from "../../auth/decorators/public.decorator";
import { NotificationsDispatchService } from "./notifications-dispatch.service";

@ApiTags("platform-notifications-webhooks")
@Public()
@Controller("platform/notifications/v1/webhooks")
export class NotificationsWebhookController {
  constructor(private readonly dispatch: NotificationsDispatchService) {}

  @Post(":provider")
  @ApiOperation({ summary: "Provider delivery status webhook (WABA/SMS/email BSP)" })
  async receive(
    @Param("provider") provider: string,
    @Body() body: Record<string, unknown>,
  ) {
    const outboxId =
      typeof body.outboxId === "string"
        ? body.outboxId
        : typeof body.outbox_id === "string"
          ? body.outbox_id
          : undefined;
    const statusRaw =
      typeof body.status === "string" ? body.status.toUpperCase() : "SENT";
    const status =
      statusRaw === "FAILED"
        ? NotificationOutboxStatus.FAILED
        : NotificationOutboxStatus.SENT;
    if (outboxId) {
      await this.dispatch.applyProviderWebhook(
        outboxId,
        status,
        { provider, ...body },
        typeof body.error === "string" ? body.error : undefined,
      );
    }
    return { ok: true };
  }
}
