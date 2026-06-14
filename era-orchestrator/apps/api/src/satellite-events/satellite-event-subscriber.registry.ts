import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isInvoiceGlPosted, type InvoiceGlPostedEvent } from "@era/contracts";

export type SatelliteEventSubscriber = {
  key: string;
  matches: (event: Record<string, unknown>) => boolean;
  handle: (event: Record<string, unknown>) => Promise<void>;
};

@Injectable()
export class SatelliteEventSubscriberRegistry {
  private readonly logger = new Logger(SatelliteEventSubscriberRegistry.name);
  private readonly subscribers: SatelliteEventSubscriber[] = [];

  constructor(private readonly config: ConfigService) {
    this.registerBuiltInSubscribers();
  }

  register(subscriber: SatelliteEventSubscriber): void {
    this.subscribers.push(subscriber);
  }

  async dispatch(event: Record<string, unknown>): Promise<string[]> {
    const handled: string[] = [];
    for (const sub of this.subscribers) {
      if (!sub.matches(event)) continue;
      try {
        await sub.handle(event);
        handled.push(sub.key);
      } catch (err) {
        this.logger.error(
          `Subscriber ${sub.key} failed for ${String(event.type)}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    return handled;
  }

  private registerBuiltInSubscribers(): void {
    if (this.config.get<string>("EXTERNAL_ACCOUNTING_ADAPTER_ENABLED") === "1") {
      this.register({
        key: "external_accounting",
        matches: (event) =>
          isInvoiceGlPosted(event) ||
          (typeof event.type === "string" &&
            event.type.startsWith("SATELLITE_") &&
            typeof event.payload === "object"),
        handle: async (event) => {
          this.logger.log(
            `[ExternalAccountingAdapter] ack type=${String(event.type)} correlation=${String(event.correlationId ?? "")}`,
          );
          const webhook = this.config.get<string>("EXTERNAL_ACCOUNTING_WEBHOOK_URL");
          if (webhook) {
            await fetch(webhook, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(event),
              signal: AbortSignal.timeout(8000),
            }).catch((e) =>
              this.logger.warn(`External accounting webhook failed: ${e}`),
            );
          }
        },
      });
    }
  }
}

/** Stub adapter for external/1C accounting — log + ack. */
export class ExternalAccountingAdapter {
  private readonly logger = new Logger(ExternalAccountingAdapter.name);

  async handleInvoiceGlPosted(event: InvoiceGlPostedEvent): Promise<{ ack: true }> {
    this.logger.log(
      `ExternalAccountingAdapter ack invoice=${event.payload.invoiceId} amount=${event.payload.amount}`,
    );
    return { ack: true };
  }
}
