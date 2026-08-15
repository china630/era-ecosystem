import { stubChannelAdapter } from '@/lib/channel/adapters/stub.adapter';
import { webhookChannelAdapter } from '@/lib/channel/adapters/webhook.adapter';
import { exelyChannelAdapter } from '@/lib/channel/adapters/exely.adapter';
import { bookingComChannelAdapter } from '@/lib/channel/adapters/booking-com.adapter';
import { expediaChannelAdapter } from '@/lib/channel/adapters/expedia.adapter';
import type { ChannelAdapter } from '@/lib/channel/adapters/types';

const ADAPTERS: Record<string, ChannelAdapter> = {
  stub: stubChannelAdapter,
  webhook: webhookChannelAdapter,
  exely: exelyChannelAdapter,
  booking_com: bookingComChannelAdapter,
  expedia: expediaChannelAdapter,
};

export function resolveChannelAdapter(): ChannelAdapter {
  const key = (process.env.ERA_CHANNEL_ADAPTER ?? 'webhook').trim().toLowerCase();
  return ADAPTERS[key] ?? webhookChannelAdapter;
}

export function listChannelAdapterCodes(): string[] {
  return Object.keys(ADAPTERS);
}

export type ChannelAdapterReadiness = {
  mode: 'dryRun' | 'live';
  envReady: boolean;
  /** Presence flags only — never include secret values. */
  envFlags: Record<string, boolean>;
};

/** Env readiness for health UI — booleans only, no secret material. */
export function getChannelAdapterReadiness(adapterCode?: string): ChannelAdapterReadiness {
  const code = (adapterCode ?? resolveChannelAdapter().code).toLowerCase();

  if (code === 'stub' || code === 'webhook') {
    return {
      mode: 'dryRun',
      envReady: true,
      envFlags: { adapter: true },
    };
  }

  if (code === 'exely') {
    const envFlags = {
      hasBaseUrl: Boolean(process.env.EXELY_API_BASE_URL?.trim()),
      hasApiKey: Boolean(process.env.EXELY_API_KEY?.trim()),
      hasPropertyId: Boolean(process.env.EXELY_PROPERTY_ID?.trim()),
    };
    const envReady = envFlags.hasBaseUrl && envFlags.hasApiKey && envFlags.hasPropertyId;
    return { mode: envReady ? 'live' : 'dryRun', envReady, envFlags };
  }

  if (code === 'booking_com') {
    const envFlags = {
      hasApiKey: Boolean(process.env.BOOKING_COM_API_KEY?.trim()),
      hasHotelId: Boolean(process.env.BOOKING_COM_HOTEL_ID?.trim()),
    };
    const envReady = envFlags.hasApiKey && envFlags.hasHotelId;
    return { mode: envReady ? 'live' : 'dryRun', envReady, envFlags };
  }

  if (code === 'expedia') {
    const envFlags = {
      hasApiKey: Boolean(process.env.EXPEDIA_API_KEY?.trim()),
      hasPropertyId: Boolean(process.env.EXPEDIA_PROPERTY_ID?.trim()),
    };
    const envReady = envFlags.hasApiKey && envFlags.hasPropertyId;
    return { mode: envReady ? 'live' : 'dryRun', envReady, envFlags };
  }

  return { mode: 'dryRun', envReady: false, envFlags: { unknownAdapter: true } };
}
