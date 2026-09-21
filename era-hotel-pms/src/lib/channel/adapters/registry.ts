import { stubChannelAdapter } from '@/lib/channel/adapters/stub.adapter';
import { webhookChannelAdapter } from '@/lib/channel/adapters/webhook.adapter';
import { channexChannelAdapter } from '@/lib/channel/adapters/channex.adapter';
import { exelyChannelAdapter } from '@/lib/channel/adapters/exely.adapter';
import { bookingComChannelAdapter } from '@/lib/channel/adapters/booking-com.adapter';
import { expediaChannelAdapter } from '@/lib/channel/adapters/expedia.adapter';
import type { ChannelAdapter } from '@/lib/channel/adapters/types';
import {
  getChannelManagerBinding,
  type ChannelManagerProvider,
} from '@/lib/channel/channel-manager-binding.service';

const ADAPTERS: Record<string, ChannelAdapter> = {
  off: stubChannelAdapter,
  stub: stubChannelAdapter,
  webhook: webhookChannelAdapter,
  channex: channexChannelAdapter,
  /** Legacy dry-run only — not SoR; prefer channex via org binding. */
  exely: exelyChannelAdapter,
  booking_com: bookingComChannelAdapter,
  expedia: expediaChannelAdapter,
};

/**
 * Resolve adapter from org ChannelManagerBinding (ADR hotel-channel-manager-pack).
 * Process env ERA_CHANNEL_ADAPTER is deprecated and ignored as SoR.
 */
export async function resolveChannelAdapter(
  organizationId?: string,
): Promise<ChannelAdapter> {
  const binding = await getChannelManagerBinding(organizationId);
  const key = (binding?.provider ?? 'off') as ChannelManagerProvider;
  if (key === 'off') return stubChannelAdapter;
  return ADAPTERS[key] ?? stubChannelAdapter;
}

export function listChannelAdapterCodes(): string[] {
  return ['off', 'stub', 'webhook', 'channex'];
}

export type ChannelAdapterReadiness = {
  mode: 'dryRun' | 'live';
  envReady: boolean;
  /** Presence flags only — never include secret values. */
  envFlags: Record<string, boolean>;
};

/** Binding readiness for health UI — booleans only, no secret material. */
export async function getChannelAdapterReadiness(
  organizationId?: string,
): Promise<ChannelAdapterReadiness> {
  const binding = await getChannelManagerBinding(organizationId);
  if (!binding || binding.provider === 'off' || binding.provider === 'stub') {
    return {
      mode: 'dryRun',
      envReady: true,
      envFlags: { binding: Boolean(binding), provider: true },
    };
  }

  if (binding.provider === 'webhook') {
    return {
      mode: 'dryRun',
      envReady: true,
      envFlags: { binding: true, hasWebhookSecret: binding.hasWebhookSecret },
    };
  }

  if (binding.provider === 'channex') {
    const { fetchChannexClientConfig } = await import('@era/satellite-kit');
    const client = await fetchChannexClientConfig();
    const envFlags = {
      binding: true,
      hasPropertyId: Boolean(binding.channexPropertyId?.trim()),
      hasWebhookSecret: binding.hasWebhookSecret,
      live: binding.live,
      propertyTypeHotel: binding.propertyType === 'hotel',
      pmsCertified: client.pmsCertified,
      productionBase: client.apiBase.includes('app.channex.io'),
    };
    const envReady = envFlags.hasPropertyId && envFlags.hasWebhookSecret;
    return {
      mode:
        binding.live && envReady && (envFlags.pmsCertified || !envFlags.productionBase)
          ? 'live'
          : 'dryRun',
      envReady,
      envFlags,
    };
  }

  return { mode: 'dryRun', envReady: false, envFlags: { unknownProvider: true } };
}
