"use client";

import { ColorLegend, TEXT_DANGER_CLASS, TEXT_MUTED_CLASS, TEXT_SUCCESS_CLASS } from "@era/satellite-kit/ui";

export type MatrixSlot = {
  time: string;
  endsAt?: string;
  occupied: boolean;
  blocked?: boolean;
  lunch?: boolean;
  procedureOrderId?: string;
  patientName?: string;
  procedureName?: string;
  status?: string;
  patientRefId?: string;
  patientRefCode?: string;
  procedureCode?: string;
  staffPractitionerId?: string;
  staffName?: string;
  manuallyAdjusted?: boolean;
  /** Outpatient appointment visit (when mapped from Appointment). */
  visitId?: string | null;
};

export type MatrixResourceRow = {
  resourceId: string;
  code: string;
  name: string;
  slots: MatrixSlot[];
};

export type Slot = MatrixSlot;
export type ResourceRow = MatrixResourceRow;

export type TimeHorizon = "full" | "rest" | "+1h" | "+3h";

export type ResourceDayMatrixLabels = {
  free: string;
  empty: string;
  move: string;
  cancel: string;
  staff: string;
  now: string;
  dragHint: string;
  legendFree: string;
  legendScheduled: string;
  legendCompleted: string;
  legendBlocked: string;
  legendLunch: string;
};

type Segment =
  | { kind: "free"; slot: MatrixSlot; col: number }
  | { kind: "lunch"; slot: MatrixSlot; col: number }
  | {
      kind: "bar";
      slot: MatrixSlot;
      col: number;
      span: number;
    };

type Props = {
  date: string;
  resources: MatrixResourceRow[];
  labels: ResourceDayMatrixLabels;
  onDropFree: (resourceId: string, slotTimeIso: string) => void;
  onMove: (slot: MatrixSlot) => void;
  onCancel: (orderId: string) => void;
  onSelect?: (slot: MatrixSlot) => void;
  /** Click empty cell (e.g. create appointment). */
  onFreeClick?: (resourceId: string, slotTimeIso: string) => void;
  onDragStart?: (orderId: string) => void;
  resourceFilter?: string;
  patientFilter?: string;
  timeHorizon?: TimeHorizon;
  dayStartHour?: number;
  /** CSS width per time column (appointments use wider cols). Default 1.75rem. */
  slotColumnWidth?: string;
};

const BAKU_TZ = "Asia/Baku";

function shortName(full?: string) {
  if (!full) return "…";
  return full.trim().split(/\s+/)[0] || "…";
}

function staffInitials(full?: string) {
  if (!full?.trim()) return "";
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function bakuYmdNow() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BAKU_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function bakuMinutesNow() {
  return slotStartMinutesBaku({ time: new Date().toISOString(), occupied: false });
}

function slotStartMinutesBaku(slot: MatrixSlot): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BAKU_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(slot.time));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function formatBakuTime(iso: string): string {
  return new Intl.DateTimeFormat([], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BAKU_TZ,
  }).format(new Date(iso));
}

function barClass(status?: string) {
  switch (status) {
    case "COMPLETED":
      return "border-slate-300 bg-slate-100 text-slate-800";
    case "NO_SHOW":
      return "border-amber-400 bg-amber-50 text-amber-900";
    case "CANCELLED":
      return `border-2 border-[#E74C3C]/40 bg-[#E74C3C]/10 ${TEXT_DANGER_CLASS}`;
    case "CHECKED_IN":
      return `border-[#27AE60]/40 bg-[#27AE60]/10 ${TEXT_SUCCESS_CLASS}`;
    case "SCHEDULED":
    default:
      return "border-[#2980B9]/40 bg-[#2980B9]/10 text-[#2980B9]";
  }
}

function patientMatches(slot: MatrixSlot, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    (slot.patientName ?? "").toLowerCase().includes(q) ||
    (slot.patientRefId ?? "").toLowerCase().includes(q) ||
    (slot.patientRefCode ?? "").toLowerCase().includes(q)
  );
}

function rowHasPatient(row: MatrixResourceRow, patientQuery: string): boolean {
  const q = patientQuery.trim();
  if (!q) return true;
  return row.slots.some(
    (s) => !s.lunch && (s.occupied || s.blocked) && patientMatches(s, q),
  );
}

/** Keep only bars for the matched patient; clear other bookings on the row. */
function applyPatientFilter(row: MatrixResourceRow, patientQuery: string): MatrixResourceRow {
  const q = patientQuery.trim().toLowerCase();
  if (!q) return row;
  return {
    ...row,
    slots: row.slots.map((slot) => {
      if (slot.lunch) return slot;
      if (!(slot.occupied || slot.blocked) || patientMatches(slot, q)) return slot;
      return {
        ...slot,
        occupied: false,
        blocked: false,
        procedureOrderId: undefined,
        patientName: undefined,
        procedureName: undefined,
        procedureCode: undefined,
        status: undefined,
        staffName: undefined,
      };
    }),
  };
}

function filterSlotsByHorizon(
  slots: MatrixSlot[],
  _date: string,
  horizon: TimeHorizon,
  _dayStartHour: number,
): MatrixSlot[] {
  if (horizon === "full" || slots.length === 0) return slots;
  // Always anchor to wall-clock (Baku): now − 5 min, floored to the 5-min grid.
  // Same rule for today and other dates — so "rest / +1h / +3h" never silently
  // restart at 09:00 just because the operator opened a future day.
  const nowMin = bakuMinutesNow();
  const anchorMin = Math.floor((nowMin - 5) / 5) * 5;
  const endMin =
    horizon === "+1h"
      ? anchorMin + 60
      : horizon === "+3h"
        ? anchorMin + 180
        : Number.POSITIVE_INFINITY;
  return slots.filter((slot) => {
    const start = slotStartMinutesBaku(slot);
    return start >= anchorMin && start <= endMin;
  });
}

function alignRowSlots(row: MatrixResourceRow, timeSlots: MatrixSlot[]): MatrixSlot[] {
  const byTime = new Map(row.slots.map((s) => [s.time, s]));
  return timeSlots.map(
    (ts) =>
      byTime.get(ts.time) ?? {
        ...ts,
        occupied: false,
        blocked: false,
        lunch: ts.lunch,
      },
  );
}

function buildSegments(slots: MatrixSlot[]): Segment[] {
  const out: Segment[] = [];
  let i = 0;
  while (i < slots.length) {
    const slot = slots[i];
    if (slot.lunch) {
      out.push({ kind: "lunch", slot, col: i });
      i += 1;
      continue;
    }
    const occupied = slot.occupied || slot.blocked;
    if (!occupied || !slot.procedureOrderId) {
      out.push({ kind: "free", slot, col: i });
      i += 1;
      continue;
    }
    let span = 1;
    while (
      i + span < slots.length &&
      !slots[i + span].lunch &&
      (slots[i + span].occupied || slots[i + span].blocked) &&
      slots[i + span].procedureOrderId === slot.procedureOrderId
    ) {
      span += 1;
    }
    out.push({ kind: "bar", slot, col: i, span });
    i += span;
  }
  return out;
}

export function ResourceDayMatrix({
  date,
  resources,
  labels,
  onDropFree,
  onMove,
  onCancel,
  onSelect,
  onFreeClick,
  onDragStart,
  resourceFilter = "",
  patientFilter = "",
  timeHorizon = "full",
  dayStartHour = 9,
  slotColumnWidth = "1.75rem",
}: Props) {
  const patientQuery = patientFilter.trim();

  const filtered = resources
    .filter((r) => {
      const q = resourceFilter.trim().toLowerCase();
      if (!q) return true;
      return r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q);
    })
    .filter((row) => rowHasPatient(row, patientQuery))
    .map((row) => applyPatientFilter(row, patientFilter));

  const baseSlots = filtered[0]?.slots ?? resources[0]?.slots ?? [];
  const timeSlots = filterSlotsByHorizon(baseSlots, date, timeHorizon, dayStartHour);
  const colCount = timeSlots.length;
  const isToday = date === bakuYmdNow();

  let nowLinePct: number | null = null;
  if (isToday && colCount > 0 && timeHorizon === "full") {
    const startMin = slotStartMinutesBaku(timeSlots[0]);
    const last = timeSlots[colCount - 1];
    const endMin = slotStartMinutesBaku(last) + 5;
    const nowMin = bakuMinutesNow();
    if (nowMin >= startMin && nowMin <= endMin && endMin > startMin) {
      nowLinePct = ((nowMin - startMin) / (endMin - startMin)) * 100;
    }
  }

  // Fixed narrow columns (scroll horizontally) — do not stretch with 1fr.
  const gridCols = `10rem repeat(${Math.max(colCount, 1)}, ${slotColumnWidth})`;

  return (
    <div className="space-y-3">
      <ColorLegend
        items={[
          {
            id: "free",
            label: labels.legendFree,
            swatchClassName: "bg-emerald-50 border-emerald-200",
          },
          {
            id: "scheduled",
            label: labels.legendScheduled,
            swatchClassName: "bg-[#2980B9]/20 border-[#2980B9]/40",
          },
          {
            id: "completed",
            label: labels.legendCompleted,
            swatchClassName: "bg-slate-100 border-slate-300",
          },
          {
            id: "blocked",
            label: labels.legendBlocked,
            swatchClassName: "bg-amber-50 border-amber-300",
          },
          {
            id: "lunch",
            label: labels.legendLunch,
            swatchClassName: "bg-slate-200 border-slate-300",
          },
        ]}
      />
      <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{labels.dragHint}</p>

      {filtered.length === 0 || colCount === 0 ? (
        <p className={`text-sm ${TEXT_MUTED_CLASS}`}>{labels.empty}</p>
      ) : (
        <div className="relative max-h-[70vh] overflow-auto rounded border border-[#D5DADF]">
          <div className="relative min-w-max">
            <div style={{ display: "grid", gridTemplateColumns: gridCols }}>
              <div className={`sticky left-0 top-0 z-30 border-b border-r border-[#D5DADF] bg-white px-2 py-2 text-[11px] font-semibold ${TEXT_MUTED_CLASS}`} />
              {timeSlots.map((slot) => (
                <div
                  key={slot.time}
                  className={`sticky top-0 z-20 border-b border-[#D5DADF] bg-[#F8FAFC] px-0.5 py-2 text-center text-[10px] font-medium ${TEXT_MUTED_CLASS}`}
                >
                  {formatBakuTime(slot.time)}
                </div>
              ))}

              {filtered.map((row) => {
                const rowSlots = alignRowSlots(row, timeSlots);
                const segments = buildSegments(rowSlots);
                return (
                  <div key={row.resourceId} className="contents">
                    <div className="sticky left-0 z-10 flex items-center border-b border-r border-[#D5DADF] bg-white px-2 py-1 text-[12px] font-semibold text-[#34495E]">
                      <span className="truncate" title={`${row.name} (${row.code})`}>
                        {row.name}{" "}
                        <span className={`font-normal ${TEXT_MUTED_CLASS}`}>({row.code})</span>
                      </span>
                    </div>
                    {segments.map((seg) => {
                      if (seg.kind === "lunch") {
                        return (
                          <div
                            key={`${row.resourceId}-lunch-${seg.slot.time}`}
                            className="min-h-[3.25rem] border-b border-r border-slate-300 bg-slate-200/80"
                            style={{ gridColumn: "span 1" }}
                            title={labels.legendLunch}
                          />
                        );
                      }
                      if (seg.kind === "free") {
                        return (
                          <div
                            key={`${row.resourceId}-${seg.slot.time}`}
                            className={`min-h-[3.25rem] border-b border-r border-emerald-100 bg-emerald-50/80 ${onFreeClick ? "cursor-pointer hover:bg-emerald-100/90" : ""}`}
                            style={{ gridColumn: "span 1" }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => onDropFree(row.resourceId, seg.slot.time)}
                            onClick={() => onFreeClick?.(row.resourceId, seg.slot.time)}
                            title={labels.free}
                          />
                        );
                      }
                      const { slot, span } = seg;
                      const scheduled = slot.status === "SCHEDULED";
                      const initials = staffInitials(slot.staffName);
                      return (
                        <div
                          key={`${row.resourceId}-${slot.procedureOrderId}-${slot.time}`}
                          draggable={scheduled && Boolean(slot.procedureOrderId)}
                          onDragStart={() => {
                            if (slot.procedureOrderId) onDragStart?.(slot.procedureOrderId);
                          }}
                          className={`min-h-[3.25rem] cursor-pointer overflow-hidden border-b border-r px-1 py-0.5 text-[10px] leading-tight ${barClass(slot.status)} ${scheduled ? "cursor-grab" : ""}`}
                          style={{ gridColumn: `span ${span}` }}
                          title={`${slot.patientName ?? ""} ${slot.procedureCode ?? ""} ${slot.status ?? ""}`}
                          onClick={() => onSelect?.(slot)}
                        >
                          <div className="truncate font-semibold">{shortName(slot.patientName)}</div>
                          <div className={`truncate ${TEXT_MUTED_CLASS}`}>
                            {slot.procedureName ?? slot.procedureCode ?? ""}
                            {slot.status ? ` · ${slot.status}` : ""}
                          </div>
                          {slot.staffName ? (
                            <div className="truncate" title={`${labels.staff}: ${slot.staffName}`}>
                              {initials || slot.staffName}
                            </div>
                          ) : null}
                          {scheduled ? (
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              <button
                                type="button"
                                className="underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMove(slot);
                                }}
                              >
                                {labels.move}
                              </button>
                              <button
                                type="button"
                                className={`underline ${TEXT_DANGER_CLASS}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (slot.procedureOrderId) onCancel(slot.procedureOrderId);
                                }}
                              >
                                {labels.cancel}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            {nowLinePct != null ? (
              <div
                className="pointer-events-none absolute bottom-0 top-8 z-40 w-0.5 bg-[#E74C3C]"
                style={{
                  left: `calc(10rem + (100% - 10rem) * ${nowLinePct / 100})`,
                }}
                title={labels.now}
              >
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[#E74C3C] px-1 text-[9px] text-white">
                  {labels.now}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
