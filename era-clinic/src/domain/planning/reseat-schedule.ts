import { prisma } from "@/lib/prisma";
import { addBakuDays, bakuDateKey, todayBakuYmd } from "@/lib/baku-day";
import { dayStartInstant, listClinicDays, nextWorkingYmd } from "@/domain/planning/clinic-day";
import { releaseProcedureOccupancy } from "@/domain/procedure/procedure-allocation.service";

const LOCKED = new Set(["CHECKED_IN", "COMPLETED"]);

export type ReseatPreviewRow = {
  orderId: string;
  episodeId: string | null;
  procedureCode: string;
  procedureName: string;
  ymd: string;
  startMs: number;
  endMs: number;
  overlap: boolean;
  closedDay?: boolean;
  toYmd?: string | null;
};

export type ReseatApplyResult = {
  preview: ReseatPreviewRow[];
  skippedLocked: number;
  placedIds: string[];
  misses: Array<{
    orderId: string;
    ymd: string;
    procedureCode: string;
    procedureName: string;
    reason: string;
  }>;
};

function markOverlaps(rows: ReseatPreviewRow[]): ReseatPreviewRow[] {
  const byGuestDay = new Map<string, ReseatPreviewRow[]>();
  for (const row of rows) {
    const key = `${row.episodeId ?? row.orderId}|${row.ymd}`;
    const list = byGuestDay.get(key) ?? [];
    list.push(row);
    byGuestDay.set(key, list);
  }
  const overlapIds = new Set<string>();
  for (const list of byGuestDay.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        if (a.startMs < b.endMs && b.startMs < a.endMs) {
          overlapIds.add(a.orderId);
          overlapIds.add(b.orderId);
        }
      }
    }
  }
  return rows.map((row) => ({ ...row, overlap: overlapIds.has(row.orderId) }));
}

export function guestSlotOverlaps(
  slots: Array<{ startMs: number; endMs: number }>,
): boolean {
  const sorted = [...slots].sort((a, b) => a.startMs - b.startMs);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.startMs < sorted[i - 1]!.endMs) return true;
  }
  return false;
}

async function loadFutureScheduled(input: {
  episodeId?: string;
  orderIds?: string[];
  allOpenOverlaps?: boolean;
  allOpenClosedDays?: boolean;
  closedDaysOnly?: boolean;
}) {
  const today = todayBakuYmd();
  const ids = (input.orderIds ?? []).filter(Boolean);
  const orders = await prisma.procedureOrder.findMany({
    where: {
      status: { in: ["SCHEDULED", "CHECKED_IN", "COMPLETED"] },
      ...(input.episodeId ? { clinicalEpisodeId: input.episodeId } : {}),
      ...(ids.length ? { id: { in: ids } } : {}),
      ...((input.allOpenOverlaps || input.allOpenClosedDays || input.closedDaysOnly) &&
      !input.episodeId &&
      !ids.length
        ? { clinicalEpisode: { status: "OPEN" } }
        : {}),
    },
    select: {
      id: true,
      clinicalEpisodeId: true,
      procedureCode: true,
      procedureName: true,
      status: true,
      scheduledAt: true,
      endsAt: true,
    },
    orderBy: { scheduledAt: "asc" },
  });
  const future = orders.filter((row) => bakuDateKey(row.scheduledAt) >= today);
  const skippedLocked = future.filter((row) => LOCKED.has(row.status));
  const movable = future.filter((row) => row.status === "SCHEDULED");
  const preview = markOverlaps(
    movable.map((row) => ({
      orderId: row.id,
      episodeId: row.clinicalEpisodeId,
      procedureCode: row.procedureCode,
      procedureName: row.procedureName,
      ymd: bakuDateKey(row.scheduledAt),
      startMs: row.scheduledAt.getTime(),
      endMs: (row.endsAt ?? row.scheduledAt).getTime(),
      overlap: false,
    })),
  );
  return { preview, skippedLocked: skippedLocked.length };
}

async function stampClosedDays(preview: ReseatPreviewRow[]): Promise<ReseatPreviewRow[]> {
  if (preview.length === 0) return preview;
  const ymds = preview.map((row) => row.ymd).sort();
  const days = await listClinicDays(ymds[0]!, addBakuDays(ymds[ymds.length - 1]!, 14));
  const closed = new Set(days.filter((day) => !day.working).map((day) => day.ymd));
  return preview.map((row) => {
    const closedDay = closed.has(row.ymd);
    return {
      ...row,
      closedDay,
      toYmd: closedDay ? nextWorkingYmd(days, row.ymd) : row.ymd,
    };
  });
}

export async function previewReseatFuturePlan(input: {
  episodeId?: string;
  orderIds?: string[];
  allOpenOverlaps?: boolean;
  allOpenClosedDays?: boolean;
  closedDaysOnly?: boolean;
}): Promise<{ preview: ReseatPreviewRow[]; skippedLocked: number }> {
  if (
    !input.allOpenOverlaps &&
    !input.allOpenClosedDays &&
    !input.closedDaysOnly &&
    !input.episodeId &&
    !(input.orderIds ?? []).length
  ) {
    return { preview: [], skippedLocked: 0 };
  }
  const loaded = await loadFutureScheduled(input);
  const preview = await stampClosedDays(loaded.preview);
  if (input.allOpenOverlaps) {
    return { preview: preview.filter((row) => row.overlap), skippedLocked: loaded.skippedLocked };
  }
  if (input.allOpenClosedDays || input.closedDaysOnly) {
    return { preview: preview.filter((row) => row.closedDay), skippedLocked: loaded.skippedLocked };
  }
  return { preview, skippedLocked: loaded.skippedLocked };
}

export async function applyReseatFuturePlan(input: {
  episodeId?: string;
  orderIds?: string[];
  allOpenOverlaps?: boolean;
  allOpenClosedDays?: boolean;
  closedDaysOnly?: boolean;
}): Promise<ReseatApplyResult> {
  const loaded = await previewReseatFuturePlan(input);
  if (loaded.preview.length === 0) {
    return { ...loaded, placedIds: [], misses: [] };
  }
  const series = await prisma.procedureDaySeries.findMany({
    where: { active: true },
    include: { members: true },
  });
  const bathCodes = new Set(series.flatMap((row) => row.members.map((member) => member.procedureCode)));
  const pins: Record<string, string> = {};
  const misses: ReseatApplyResult["misses"] = [];
  for (const row of loaded.preview) {
    const target = row.toYmd ?? row.ymd;
    if (!target) {
      misses.push({
        orderId: row.orderId,
        ymd: row.ymd,
        procedureCode: row.procedureCode,
        procedureName: row.procedureName,
        reason: "no_day",
      });
      continue;
    }
    await releaseProcedureOccupancy([row.orderId]);
    await prisma.procedureOrder.update({
      where: { id: row.orderId },
      data: {
        status: "PROPOSED",
        scheduledAt: dayStartInstant(target, 9),
      },
    });
    pins[row.orderId] = target;
  }
  const { placeOrPinOrders } = await import("@/domain/procedure/place-or-pin-orders");
  const bathIds = loaded.preview
    .filter((row) => bathCodes.has(row.procedureCode) && pins[row.orderId])
    .map((row) => row.orderId);
  const otherIds = loaded.preview
    .filter((row) => !bathCodes.has(row.procedureCode) && pins[row.orderId])
    .map((row) => row.orderId);
  const placedIds: string[] = [];
  for (const ids of [bathIds, otherIds]) {
    if (ids.length === 0) continue;
    const pinYmdByOrderId = Object.fromEntries(ids.map((id) => [id, pins[id]!]));
    const result = await placeOrPinOrders(ids, { pinYmdByOrderId });
    placedIds.push(...result.placedIds);
    for (const fail of result.failures) {
      misses.push({
        orderId: fail.orderId,
        ymd: fail.ymd ?? pins[fail.orderId] ?? "",
        procedureCode: fail.procedureCode,
        procedureName: fail.procedureName,
        reason: fail.reason,
      });
    }
  }
  return { preview: loaded.preview, skippedLocked: loaded.skippedLocked, placedIds, misses };
}
