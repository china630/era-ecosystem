import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { NotificationOutboxStatus } from "@era365/database";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import { Public } from "../../auth/decorators/public.decorator";
import { NotificationsDispatchService } from "./notifications-dispatch.service";

/**
 * Platform notification delivery status webhooks (WABA/SMS/email BSP).
 * CRM bidirectional inbound must NOT use this controller — see
 * era-crm `/api/integrations/hooks/:providerKey/:publicId` (ADR docs/adr/crm/01-integrations-architecture.md).
 */
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
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: RawBodyRequest<Request>,
  ) {
    this.assertSignature(provider, req, headers, body);

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

  private assertSignature(
    provider: string,
    req: RawBodyRequest<Request>,
    headers: Record<string, string | string[] | undefined>,
    body: Record<string, unknown>,
  ): void {
    const secret =
      process.env.NOTIFICATIONS_WEBHOOK_SECRET?.trim() ||
      process.env.WHATSAPP_WEBHOOK_SECRET?.trim() ||
      "";
    const queryToken =
      typeof req.query?.k === "string" ? String(req.query.k) : undefined;

    // Prefer HMAC over raw body when secret is configured.
    if (secret) {
      const headerVal = headerString(
        headers["x-hub-signature-256"] ??
          headers["x-era-signature"] ??
          headers["x-webhook-signature"],
      );
      const raw =
        req.rawBody ??
        (typeof req.body === "string"
          ? Buffer.from(req.body)
          : Buffer.from(JSON.stringify(body ?? {})));

      if (headerVal) {
        const expected =
          "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
        if (!safeEqual(headerVal, expected)) {
          throw new UnauthorizedException("Invalid webhook signature");
        }
        return;
      }

      // Production: HMAC header required (no ?k= secret-in-URL).
      if (process.env.NODE_ENV === "production") {
        throw new UnauthorizedException(
          "Webhook signature header required in production",
        );
      }

      // Non-prod only: providers without signing may use secret query token.
      if (queryToken && safeEqual(queryToken, secret)) {
        return;
      }

      throw new UnauthorizedException(
        "Webhook signature or ?k= secret token required",
      );
    }

    if (process.env.NODE_ENV === "production") {
      throw new BadRequestException(
        `NOTIFICATIONS_WEBHOOK_SECRET required for provider=${provider}`,
      );
    }
    // Non-prod without secret: allow for local smoke only.
  }
}

function headerString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
