import { prisma } from '@/lib/prisma';
import { requestOrganizationId } from '@/lib/request-organization';
import { fetchChannexClientConfig } from '@era/satellite-kit';
import { getChannelManagerBinding } from '@/lib/channel/channel-manager-binding.service';
import type { AvailabilityPushRow } from '@/lib/channel/adapters/types';
import {
  allowAriForBinding,
  isChannexUuid,
  postAvailability,
  postRestrictions,
  CHANNEX_AVAIL_CALLS_PER_MIN,
  CHANNEX_RESTRICTION_CALLS_PER_MIN,
} from '@/lib/channel/channex-api';
import {
  canonicalizeAriRows,
  hashAriPayload,
  splitAriJobs,
  softCapWarnings,
  type AriJobKind,
} from '@/lib/channel/channel-ari-payload';

export {
  CHANNEX_SOFT_ROOM_TYPE_CAP,
  CHANNEX_SOFT_RATE_PLAN_CAP,
  canonicalizeAriRows,
  hashAriPayload,
  splitAriJobs,
  softCapWarnings,
} from '@/lib/channel/channel-ari-payload';
export type { AriJobKind } from '@/lib/channel/channel-ari-payload';

const STALE_PROCESSING_MS = 10 * 60_000;

async function enqueueKind(kind: AriJobKind, rows: AvailabilityPushRow[]) {
  if (!rows.length) return null;
  const orgId = requestOrganizationId();
  const payloadHash = hashAriPayload(kind, rows);
  const existing = await prisma.channelAriJob.findFirst({
    where: {
      organizationId: orgId,
      kind,
      payloadHash,
      status: { in: ['PENDING', 'PROCESSING'] },
    },
  });
  if (existing) return existing;

  const payloadJson = JSON.stringify({ kind, rows: canonicalizeAriRows(rows) });
  return prisma.channelAriJob.create({
    data: {
      organizationId: orgId,
      kind,
      payloadHash,
      payloadJson,
      status: 'PENDING',
    },
  });
}

export async function enqueueAriPush(rows: AvailabilityPushRow[]) {
  const warnings = softCapWarnings(rows);
  if (warnings.length) {
    console.warn('[channex] soft cap', warnings.join('; '));
  }
  const split = splitAriJobs(rows);
  const availability = await enqueueKind('AVAILABILITY', split.availability);
  const restrictions = await enqueueKind('RESTRICTIONS', split.restrictions);
  return { availability, restrictions, warnings };
}

export async function countPendingAriJobs(organizationId?: string) {
  const orgId = organizationId ?? requestOrganizationId();
  return prisma.channelAriJob.count({
    where: { organizationId: orgId, status: { in: ['PENDING', 'PROCESSING'] } },
  });
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function reclaimStaleProcessing(organizationId: string) {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS);
  await prisma.channelAriJob.updateMany({
    where: {
      organizationId,
      status: 'PROCESSING',
      processingStartedAt: { lt: cutoff },
    },
    data: { status: 'PENDING', lastError: 'stale PROCESSING reclaimed' },
  });
}

function channexWarnings(json: unknown): string[] {
  if (!json || typeof json !== 'object') return [];
  const meta = (json as { meta?: { warnings?: unknown[] } }).meta;
  if (!Array.isArray(meta?.warnings) || meta.warnings.length === 0) return [];
  return meta.warnings.map((w) => JSON.stringify(w).slice(0, 200));
}

/**
 * Drain ARI: POST /availability (room_type_id) and POST /restrictions (rate_plan_id).
 * Budget: 10 + 10 calls/min/property (Channex Channel API).
 */
export async function drainAriQueueForOrg(organizationId: string, maxJobs = 10) {
  const binding = await getChannelManagerBinding(organizationId);
  if (!binding || binding.provider !== 'channex' || !binding.channexPropertyId) {
    return { drained: 0, skipped: true as const, reason: 'no_channex_binding' };
  }

  const client = await fetchChannexClientConfig();
  const allow = allowAriForBinding({ live: binding.live, client });
  if (allow !== 'ok') {
    return { drained: 0, skipped: true as const, reason: allow };
  }

  await reclaimStaleProcessing(organizationId);

  const now = new Date();
  const jobs = await prisma.channelAriJob.findMany({
    where: {
      organizationId,
      status: 'PENDING',
      notBefore: { lte: now },
    },
    orderBy: { createdAt: 'asc' },
    take: maxJobs,
  });

  let drained = 0;
  let availCalls = 0;
  let restrictionCalls = 0;
  const propertyId = binding.channexPropertyId;

  for (const job of jobs) {
    const kind = (job.kind as AriJobKind) || 'AVAILABILITY';
    if (kind === 'AVAILABILITY' && availCalls >= CHANNEX_AVAIL_CALLS_PER_MIN) continue;
    if (kind === 'RESTRICTIONS' && restrictionCalls >= CHANNEX_RESTRICTION_CALLS_PER_MIN) {
      continue;
    }

    await prisma.channelAriJob.update({
      where: { id: job.id },
      data: {
        status: 'PROCESSING',
        attempts: { increment: 1 },
        processingStartedAt: new Date(),
      },
    });

    try {
      const payload = JSON.parse(job.payloadJson) as { rows: AvailabilityPushRow[] };
      const rows = payload.rows ?? [];
      const result =
        kind === 'RESTRICTIONS'
          ? await postRestrictions(
              client,
              rows
                .filter((r) => isChannexUuid(r.otaRateCode))
                .map((r) => ({
                  property_id: propertyId,
                  rate_plan_id: r.otaRateCode,
                  date: r.date,
                  rate: r.price != null ? String(Number(r.price).toFixed(2)) : undefined,
                  stop_sell: Boolean(r.stopSell || r.available <= 0),
                })),
            )
          : await postAvailability(
              client,
              rows
                .filter((r) => isChannexUuid(r.otaRoomCode))
                .map((r) => ({
                  property_id: propertyId,
                  room_type_id: r.otaRoomCode,
                  date: r.date,
                  availability: r.stopSell ? 0 : Math.max(0, r.available),
                })),
            );

      if (kind === 'RESTRICTIONS') restrictionCalls += 1;
      else availCalls += 1;

      if (result.status === 429) {
        await prisma.channelAriJob.update({
          where: { id: job.id },
          data: {
            status: 'PENDING',
            lastError: '429 rate limited',
            notBefore: new Date(Date.now() + (result.retryAfterMs ?? 60_000)),
            processingStartedAt: null,
          },
        });
        await sleep(250);
        continue;
      }

      if (!result.ok) {
        await prisma.channelAriJob.update({
          where: { id: job.id },
          data: {
            status: job.attempts >= 5 ? 'FAILED' : 'PENDING',
            lastError: `Channex ${result.status}: ${result.text.slice(0, 500)}`,
            notBefore: new Date(Date.now() + 30_000),
            processingStartedAt: null,
          },
        });
        continue;
      }

      const warn = channexWarnings(result.json);
      await prisma.channelAriJob.update({
        where: { id: job.id },
        data: {
          status: 'DONE',
          lastError: warn.length ? `warnings: ${warn.join('; ')}` : null,
          processingStartedAt: null,
        },
      });
      drained += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ARI drain failed';
      await prisma.channelAriJob.update({
        where: { id: job.id },
        data: {
          status: 'PENDING',
          lastError: message,
          notBefore: new Date(Date.now() + 30_000),
          processingStartedAt: null,
        },
      });
    }
  }

  return {
    drained,
    skipped: false as const,
    calls: availCalls + restrictionCalls,
    availCalls,
    restrictionCalls,
  };
}
