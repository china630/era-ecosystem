import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import {
  classifyBridgePayload,
  extractRows,
  rowHotelId,
  type BridgeEntityHint,
} from '@/lib/integration/elektraweb-bridge/classify';
import { assertHotelIdMatches } from '@/lib/integration/elektraweb-bridge/config';
import type { BridgeAuthContext } from '@/lib/integration/elektraweb-bridge/auth';
import { upsertGuestFromElektrawebRow } from '@/lib/integration/elektraweb-bridge/upsert-guest';
import { upsertReservationFromElektrawebRow } from '@/lib/integration/elektraweb-bridge/upsert-reservation';
import { upsertReservationNoteFromElektrawebRow } from '@/lib/integration/elektraweb-bridge/upsert-reservation-note';
import { upsertFolioFromElektrawebRow } from '@/lib/integration/elektraweb-bridge/upsert-folio';
import { stampStayGuestResNameId } from '@/lib/integration/elektraweb-bridge/stamp-resnameid';

export const bridgeEnvelopeSchema = z.object({
  capturedAt: z.string().min(1),
  sourceUrl: z.string().min(1),
  pageUrl: z.string().optional(),
  method: z.string().optional(),
  entityHint: z.enum(['guest', 'reservation', 'folio', 'unknown']).optional(),
  elektrawebAppVersion: z.string().optional(),
  raw: z.unknown(),
});

export type BridgeEnvelope = z.infer<typeof bridgeEnvelopeSchema>;

export type BridgeIngestSummary = {
  organizationId: string;
  elektrawebHotelId: number;
  entity: BridgeEntityHint;
  objectName: string | null;
  accepted: number;
  created: number;
  updated: number;
  skipped: number;
  eventsEmitted: string[];
  errors: Array<{ index: number; message: string }>;
};

let lastSuccessAt: string | null = null;
let lastError: string | null = null;
let ingestCount24h = 0;
let ingestWindowStart = Date.now();

export function getBridgeHealth() {
  const now = Date.now();
  if (now - ingestWindowStart > 24 * 60 * 60 * 1000) {
    ingestWindowStart = now;
    ingestCount24h = 0;
  }
  return {
    enabled: process.env.ELEKTRAWEB_BRIDGE_ENABLED === '1',
    lastSuccessAt,
    lastError,
    ingestCount24h,
  };
}

function touchSuccess() {
  lastSuccessAt = new Date().toISOString();
  lastError = null;
  const now = Date.now();
  if (now - ingestWindowStart > 24 * 60 * 60 * 1000) {
    ingestWindowStart = now;
    ingestCount24h = 0;
  }
  ingestCount24h += 1;
}

function touchError(message: string) {
  lastError = message;
}

export async function ingestElektrawebBridgeEnvelope(
  auth: BridgeAuthContext,
  envelope: BridgeEnvelope,
): Promise<BridgeIngestSummary> {
  const { entity, objectName } = classifyBridgePayload({
    sourceUrl: envelope.sourceUrl,
    entityHint: envelope.entityHint,
  });

  const rows = extractRows(envelope.raw);
  const summary: BridgeIngestSummary = {
    organizationId: auth.organizationId,
    elektrawebHotelId: auth.elektrawebHotelId,
    entity,
    objectName,
    accepted: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    eventsEmitted: [],
    errors: [],
  };

  if (entity === 'unknown' || rows.length === 0) {
    summary.skipped = rows.length;
    return summary;
  }

  // Soft identity docs — skip (QG_HOTEL_GUEST_ID without useful guest sync alone)
  if (objectName === 'QG_HOTEL_GUEST_ID') {
    summary.skipped = rows.length;
    return summary;
  }

  const noteStampIds = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    try {
      const hid = rowHotelId(row);
      if (hid != null) await assertHotelIdMatches(hid);
      // Detail payloads sometimes omit HOTELID — still OK if auth hotel matches policy

      if (objectName === 'QA_EASYPMS_NOTES') {
        const r = await upsertReservationNoteFromElektrawebRow(row);
        if (r.action === 'skipped') {
          summary.skipped += 1;
        } else {
          summary.accepted += 1;
          if (r.action === 'created') summary.created += 1;
          else summary.updated += 1;
          if (r.reservationId) noteStampIds.add(r.reservationId);
        }
        continue;
      }

      if (entity === 'guest') {
        if (objectName === 'QA_HOTEL_RES_GUEST') {
          await stampStayGuestResNameId(row);
          // ID on this object is SPA RESNAMEID — only upsert Guest Card when GUESTID is present.
          const guestCardId =
            row.GUESTID != null && row.GUESTID !== '' ? String(row.GUESTID) : '';
          if (!guestCardId) {
            summary.skipped += 1;
            continue;
          }
        }
        const r = await upsertGuestFromElektrawebRow(row);
        summary.accepted += 1;
        if (r.action === 'created') summary.created += 1;
        else if (r.action === 'updated') summary.updated += 1;
        else summary.skipped += 1;
      } else if (entity === 'reservation') {
        const r = await upsertReservationFromElektrawebRow(row);
        summary.accepted += 1;
        if (r.action === 'created') summary.created += 1;
        else summary.updated += 1;
        summary.eventsEmitted.push(...r.events);
      } else if (entity === 'folio') {
        const r = await upsertFolioFromElektrawebRow(row);
        if (r.action === 'skipped') {
          summary.skipped += 1;
        } else {
          summary.accepted += 1;
          if (r.action === 'created') summary.created += 1;
          else summary.updated += 1;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.errors.push({ index: i, message });
      // Hard fail whole batch on tenant mismatch
      if (message.includes('HOTELID mismatch')) {
        touchError(message);
        throw err;
      }
    }
  }

  if (noteStampIds.size > 0) {
    const { stampMedicalPackagesForReservation } = await import(
      '@/lib/services/medical-package-stamp.service'
    );
    for (const reservationId of noteStampIds) {
      await stampMedicalPackagesForReservation(prisma, reservationId);
    }
  }

  if (summary.errors.length && summary.accepted === 0) {
    touchError(summary.errors[0]!.message);
  } else {
    touchSuccess();
  }

  return summary;
}
