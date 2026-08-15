const fs = require("fs");
const path = require("path");

const out = path.join(__dirname, "../../src/components/sanatorium/ResourceDayMatrix.tsx");

const src = `"use client";

import { ColorLegend } from "@era/satellite-kit/ui";

export type MatrixSlot = {
  time: string;
  endsAt?: string;
  occupied: boolean;
  blocked?: boolean;
  procedureOrderId?: string;
  patientName?: string;
  procedureName?: string;
  status?: string;
  patientRefId?: string;
  procedureCode?: string;
  staffPractitionerId?: string;
  staffName?: string;
  manuallyAdjusted?: boolean;
};

export type MatrixResourceRow = {
  resourceId: string;
  code: string;
  name: string;
  slots: MatrixSlot[];
};

export type ResourceDayMatrixLabels = {
  free: string;
  empty: string;
  move: string;
  cancel: string;
  staff: string;
  now: string;
  dragHint: string;
  filterResource: string;
  legendFree: string;
  legendScheduled: string;
  legendCompleted: string;
  legendBlocked: string;
  refresh?: string;
};

type Segment =
  | { kind: "free"; slot: MatrixSlot; col: number }
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
  onDragStart?: (orderId: string) => void;
  resourceFilter?: string;
  onResourceFilterChange?: (value: string) => void;
};

function shortName(full?: string) {
  if (!full) return "…";
  return full.trim().split(/\\s+/)[0] || "…";
}

function staffInitials(full?: string) {
  if (!full?.trim()) return "";
  const parts = full.trim().split(/\\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function bakuYmdNow() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function bakuMinutesNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Baku",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function barClass(status?: string) {
  switch (status) {
    case "COMPLETED":
      return "border-slate-300 bg-slate-100 text-slate-800";
    case "NO_SHOW":
      return "border-amber-400 bg-amber-50 text-amber-900";
    case "CANCELLED":
      return "border-2 border-red-400 bg-red-50/40 text-red-800";
    case "CHECKED_IN":
      return "border-emerald-300 bg-emerald-50 text-emerald-900";
    case "SCHEDULED":
    default:
      return "border-[#2980B9]/40 bg-[#2980B9]/10 text-[#1a5276]";
  }
}

function buildSegments(slots: MatrixSlot[]): Segment[] {
  const out: Segment[] = [];
  let i = 0;
  while (i < slots.length) {
    const slot = slots[i];
    const occupied = slot.occupied || slot.blocked;
    if (!occupied || !slot.procedureOrderId) {
      out.push({ kind: "free", slot, col: i });
      i += 1;
      continue;
    }
    let span = 1;
    while (
      i + span < slots.length &&
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
  onDragStart,
  resourceFilter = "",
  onResourceFilterChange,
}: Props) {
  const filtered = resources.filter((r) => {
    const q = resourceFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q)
    );
  });

  const timeSlots = filtered[0]?.slots ?? resources[0]?.slots ?? [];
  const colCount = timeSlots.length;
  const isToday = date === bakuYmdNow();

  let nowLinePct: number | null = null;
  if (isToday && colCount > 0) {
    const first = new Date(timeSlots[0].time);
    const last = new Date(
      timeSlots[colCount - 1].endsAt ??
        new Date(new Date(timeSlots[colCount - 1].time).getTime() + 5 * 60_000),
    );
    const startMin = first.getHours() * 60 + first.getMinutes();
    const endMin = last.getHours() * 60 + last.getMinutes();
    const nowMin = bakuMinutesNow();
    if (nowMin >= startMin && nowMin <= endMin && endMin > startMin) {
      nowLinePct = ((nowMin - startMin) / (endMin - startMin)) * 100;
    }
  }

  const gridCols = \`10rem repeat(\${Math.max(colCount, 1)}, minmax(2.75rem, 1fr))\`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        {onResourceFilterChange ? (
          <label className="text-sm">
            {labels.filterResource}{" "}
            <input
              className="ml-1 rounded border border-[#D5DADF] px-2 py-1 text-[13px]"
              value={resourceFilter}
              onChange={(e) => onResourceFilterChange(e.target.value)}
              placeholder={labels.filterResource}
            />
          </label>
        ) : null}
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
          ]}
        />
      </div>
      <p className="text-[12px] text-[#7F8C8D]">{labels.dragHint}</p>

      {filtered.length === 0 || colCount === 0 ? (
        <p className="text-sm text-[#7F8C8D]">{labels.empty}</p>
      ) : (
        <div className="relative max-h-[70vh] overflow-auto rounded border border-[#D5DADF]">
          <div
            className="relative min-w-max"
            style={{ display: "grid", gridTemplateColumns: gridCols }}
          >
            <div className="sticky left-0 top-0 z-30 border-b border-r border-[#D5DADF] bg-white px-2 py-2 text-[11px] font-semibold text-[#7F8C8D]">
              {/* corner */}
            </div>
            {timeSlots.map((slot) => {
              const label = new Date(slot.time).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <div
                  key={slot.time}
                  className="sticky top-0 z-20 border-b border-[#D5DADF] bg-[#FAFBFC] px-0.5 py-2 text-center text-[10px] font-medium text-[#7F8C8D]"
                >
                  {label}
                </div>
              );
            })}

            {filtered.map((row) => {
              const segments = buildSegments(row.slots);
              return (
                <div key={row.resourceId} className="contents">
                  <div className="sticky left-0 z-10 flex items-center border-b border-r border-[#D5DADF] bg-white px-2 py-1 text-[12px] font-semibold text-[#34495E]">
                    <span className="truncate" title={\`\${row.name} (\${row.code})\`}>
                      {row.name}{" "}
                      <span className="font-normal text-[#7F8C8D]">({row.code})</span>
                    </span>
                  </div>
                  {segments.map((seg) => {
                    if (seg.kind === "free") {
                      return (
                        <div
                          key={\`\${row.resourceId}-\${seg.slot.time}\`}
                          className="min-h-[3.25rem] border-b border-r border-emerald-100 bg-emerald-50/80"
                          style={{ gridColumn: \`span 1\` }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => onDropFree(row.resourceId, seg.slot.time)}
                          title={labels.free}
                        />
                      );
                    }
                    const { slot, span } = seg;
                    const scheduled = slot.status === "SCHEDULED";
                    const initials = staffInitials(slot.staffName);
                    return (
                      <div
                        key={\`\${row.resourceId}-\${slot.procedureOrderId}-\${slot.time}\`}
                        draggable={scheduled && Boolean(slot.procedureOrderId)}
                        onDragStart={() => {
                          if (slot.procedureOrderId) onDragStart?.(slot.procedureOrderId);
                        }}
                        className={\`min-h-[3.25rem] cursor-default overflow-hidden border-b border-r px-1 py-0.5 text-[10px] leading-tight \${barClass(slot.status)} \${scheduled ? "cursor-grab" : ""}\`}
                        style={{ gridColumn: \`span \${span}\` }}
                        title={\`\${slot.patientName ?? ""} \${slot.procedureCode ?? ""} \${slot.status ?? ""}\`}
                      >
                        <div className="truncate font-semibold">{shortName(slot.patientName)}</div>
                        <div className="truncate text-[#7F8C8D]">
                          {slot.procedureCode ?? slot.procedureName ?? ""}
                          {slot.status ? \` · \${slot.status}\` : ""}
                        </div>
                        {slot.staffName ? (
                          <div className="truncate" title={\`\${labels.staff}: \${slot.staffName}\`}>
                            {initials || slot.staffName}
                          </div>
                        ) : null}
                        {scheduled ? (
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            <button
                              type="button"
                              className="underline"
                              onClick={() => onMove(slot)}
                            >
                              {labels.move}
                            </button>
                            <button
                              type="button"
                              className="underline text-red-700"
                              onClick={() =>
                                slot.procedureOrderId
                                  ? onCancel(slot.procedureOrderId)
                                  : undefined
                              }
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

            {nowLinePct != null ? (
              <div
                className="pointer-events-none absolute bottom-0 top-8 z-40 w-0.5 bg-red-500"
                style={{
                  left: \`calc(10rem + (100% - 10rem) * \${nowLinePct / 100})\`,
                }}
                title={labels.now}
              >
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-red-500 px-1 text-[9px] text-white">
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
`;

fs.writeFileSync(out, src, "utf8");
const b = fs.readFileSync(out);
console.log("wrote ResourceDayMatrix.tsx byte0=", b[0], "bytes=", b.length);
if (b[0] === 0) {
  console.error("UTF-16 null detected");
  process.exit(1);
}