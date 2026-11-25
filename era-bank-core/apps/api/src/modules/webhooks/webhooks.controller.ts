import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
} from "class-validator";
import { BankAuthGuard } from "../../auth/bank-auth.guard";
import { WebhooksService } from "./webhooks.service";

class SubscribeWebhookDto {
  @IsUrl({ require_protocol: true, protocols: ["https", "http"] })
  url!: string;

  @IsArray()
  @IsString({ each: true })
  events!: string[];

  @IsOptional()
  @IsString()
  secret?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

class DeliverWebhookDto {
  @IsString()
  eventType!: string;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

@ApiTags("webhooks")
@ApiBearerAuth()
@UseGuards(BankAuthGuard)
@Controller("webhooks")
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get("subscriptions")
  list() {
    return this.webhooks.list();
  }

  @Post("subscriptions")
  subscribe(@Body() body: SubscribeWebhookDto) {
    return this.webhooks.subscribe(body);
  }

  @Post("subscriptions/:id/deliver")
  deliver(@Param("id") id: string, @Body() body: DeliverWebhookDto) {
    if (body.dryRun) {
      return this.webhooks.buildDeliveryStub(id, body.eventType, body.payload);
    }
    return this.webhooks.deliver(id, body.eventType, body.payload);
  }

  @Post("subscriptions/:id/enqueue")
  enqueue(@Param("id") id: string, @Body() body: DeliverWebhookDto) {
    return this.webhooks.enqueueOutbox(id, body.eventType, body.payload);
  }

  @Get("outbox")
  listOutbox() {
    return this.webhooks.listOutbox();
  }

  @Post("outbox/drain")
  drainOutbox(@Body() body?: { limit?: number }) {
    return this.webhooks.drainOutbox(body?.limit ?? 20);
  }
}