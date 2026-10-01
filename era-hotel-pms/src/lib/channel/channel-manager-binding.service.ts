import { prisma } from '@/lib/prisma';
import { requestOrganizationId } from '@/lib/request-organization';
import { randomBytes } from 'crypto';
import {
  CronOrganizationListError,
  SatelliteOrganizationUnboundError,
  fetchChannexClientConfig,
  listCronOrganizationIds,
  runWithSatelliteTenant,
} from '@era/satellite-kit';
import { fetchHotelPoolOrganizationIds } from '@/lib/cron-organization-ids';
import { decryptSecret, encryptSecret } from '@/lib/crypto/secret-box';
import { isChannexProductionBase } from '@/lib/channel/channex-api';

export type ChannelManagerProvider = 'off' | 'stub' | 'webhook' | 'channex';

export type ChannelManagerBindingPublic = {
  organizationId: string;
  provider: ChannelManagerProvider;
  channexPropertyId: string | null;
  propertyType: 'hotel' | 'vacation_rental';
  live: boolean;
  ibePublishableKey: string | null;
  ibeAllowedOrigins: string[];
  hasWebhookSecret: boolean;
};

const PROVIDERS = new Set<ChannelManagerProvider>(['off', 'stub', 'webhook', 'channex']);

function asOrigins(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
}

function toPublic(row: {
  organizationId: string;
  provider: string;
  channexPropertyId: string | null;
  propertyType: string;
  live: boolean;
  ibePublishableKey: string | null;
  ibeAllowedOrigins: unknown;
  webhookSecretCipher: string | null;
}): ChannelManagerBindingPublic {
  const provider = PROVIDERS.has(row.provider as ChannelManagerProvider)
    ? (row.provider as ChannelManagerProvider)
    : 'off';
  return {
    organizationId: row.organizationId,
    provider,
    channexPropertyId: row.channexPropertyId,
    propertyType: row.propertyType === 'vacation_rental' ? 'vacation_rental' : 'hotel',
    live: row.live,
    ibePublishableKey: row.ibePublishableKey,
    ibeAllowedOrigins: asOrigins(row.ibeAllowedOrigins),
    hasWebhookSecret: Boolean(row.webhookSecretCipher?.trim()),
  };
}

export async function getChannelManagerBinding(
  organizationId?: string,
): Promise<ChannelManagerBindingPublic | null> {
  const orgId = organizationId?.trim() || requestOrganizationId();
  const row = await prisma.channelManagerBinding.findUnique({
    where: { organizationId: orgId },
  });
  return row ? toPublic(row) : null;
}

type BindingKey = { channexPropertyId: string } | { ibePublishableKey: string };

/**
 * Vendor keys are unique across the pool. Orgs come from the orch registry
 * (SHARED) or the process org (DEDICATED / ONPREM); each lookup runs with the
 * tenant filter on. Registry failure throws `CronOrganizationListError` /
 * `SatelliteOrganizationUnboundError` — callers answer 503.
 */
async function findBindingInPool(where: BindingKey) {
  const organizationIds = await listCronOrganizationIds(fetchHotelPoolOrganizationIds);
  for (const organizationId of organizationIds) {
    const row = await runWithSatelliteTenant({ organizationId }, () =>
      prisma.channelManagerBinding.findFirst({ where }),
    );
    if (row) return row;
  }
  return null;
}

export function isBindingPoolUnavailable(err: unknown): boolean {
  return (
    err instanceof CronOrganizationListError || err instanceof SatelliteOrganizationUnboundError
  );
}

/** Webhook lookup: the caller enters the returned row's org before any work. */
export async function getChannelManagerBindingByPropertyId(propertyId: string) {
  const id = propertyId.trim();
  if (!id) return null;
  return findBindingInPool({ channexPropertyId: id });
}

export function bindingWebhookPlaintext(cipher: string | null | undefined): string | null {
  if (!cipher?.trim()) return null;
  return decryptSecret(cipher);
}

async function ensureChannexChannel(orgId: string) {
  const existing = await prisma.channel.findFirst({
    where: { organizationId: orgId, code: 'CHANNEX' },
  });
  if (existing) {
    if (!existing.active) {
      await prisma.channel.update({ where: { id: existing.id }, data: { active: true } });
    }
    return existing;
  }
  return prisma.channel.create({
    data: {
      organizationId: orgId,
      code: 'CHANNEX',
      name: 'Channex',
      active: true,
    },
  });
}

async function uniqueIbeKey(): Promise<string> {
  for (let i = 0; i < 8; i += 1) {
    const key = `pk_${randomBytes(16).toString('hex')}`;
    const clash = await findBindingInPool({ ibePublishableKey: key });
    if (!clash) return key;
  }
  throw new Error('Could not allocate unique IBE key');
}

/** IBE lookup: the caller enters the returned row's org before any work. */
export async function getChannelManagerBindingByIbeKey(publishableKey: string) {
  const key = publishableKey.trim();
  if (!key) return null;
  return findBindingInPool({ ibePublishableKey: key });
}

export type UpsertChannelManagerBindingInput = {
  provider?: ChannelManagerProvider;
  channexPropertyId?: string | null;
  propertyType?: 'hotel' | 'vacation_rental';
  live?: boolean;
  ibeAllowedOrigins?: string[];
  webhookSecret?: string | null;
  rotateIbeKey?: boolean;
};

export async function upsertChannelManagerBinding(
  input: UpsertChannelManagerBindingInput,
): Promise<ChannelManagerBindingPublic> {
  const orgId = requestOrganizationId();
  const existing = await prisma.channelManagerBinding.findUnique({
    where: { organizationId: orgId },
  });

  const provider = input.provider ?? (existing?.provider as ChannelManagerProvider | undefined) ?? 'off';
  if (!PROVIDERS.has(provider)) {
    throw new Error(`Invalid channel provider: ${provider}`);
  }

  const live = input.live ?? existing?.live ?? false;
  if (live && provider !== 'channex') {
    throw new Error('Live flag requires provider=channex');
  }
  if (live && !(input.channexPropertyId ?? existing?.channexPropertyId)?.trim()) {
    throw new Error('Live flag requires channexPropertyId');
  }
  if (provider === 'channex') {
    const nextSecret =
      input.webhookSecret === undefined
        ? existing?.webhookSecretCipher
        : input.webhookSecret?.trim();
    if (!nextSecret) {
      throw new Error('Channex binding requires a webhook secret');
    }
  }
  if (live) {
    const client = await fetchChannexClientConfig();
    if (!client.hasApiKey) {
      throw new Error('Live flag requires Channex partner API key in Control Plane');
    }
    if (isChannexProductionBase(client.apiBase) && !client.pmsCertified) {
      throw new Error(
        'Live production property requires Super-Admin Channex PMS certification flag',
      );
    }
  }

  const needNewKey =
    input.rotateIbeKey ||
    !existing?.ibePublishableKey ||
    (input.provider === 'channex' && !existing?.ibePublishableKey);
  const ibeKey = needNewKey ? await uniqueIbeKey() : existing!.ibePublishableKey!;

  const webhookSecretCipher =
    input.webhookSecret === undefined
      ? existing?.webhookSecretCipher ?? null
      : input.webhookSecret?.trim()
        ? encryptSecret(input.webhookSecret.trim())
        : null;

  const data = {
    provider,
    channexPropertyId:
      input.channexPropertyId === undefined
        ? existing?.channexPropertyId ?? null
        : input.channexPropertyId?.trim() || null,
    propertyType: input.propertyType ?? (existing?.propertyType as 'hotel' | 'vacation_rental') ?? 'hotel',
    live,
    ibePublishableKey: ibeKey,
    ibeAllowedOrigins: input.ibeAllowedOrigins ?? asOrigins(existing?.ibeAllowedOrigins) ?? [],
    webhookSecretCipher,
  };

  const row = await prisma.channelManagerBinding.upsert({
    where: { organizationId: orgId },
    create: { organizationId: orgId, ...data },
    update: data,
  });
  if (provider === 'channex') {
    await ensureChannexChannel(orgId);
  }
  return toPublic(row);
}

/** Adapter code from binding — never process env. */
export async function resolveProviderForOrg(
  organizationId?: string,
): Promise<ChannelManagerProvider> {
  const binding = await getChannelManagerBinding(organizationId);
  return binding?.provider ?? 'off';
}
