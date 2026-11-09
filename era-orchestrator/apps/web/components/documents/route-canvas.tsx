"use client";

import { useMemo, useRef, useState } from "react";

export type CanvasStep = {
  stepOrder: number;
  label: string;
  detail: string;
  layoutX: number | null;
  layoutY: number | null;
  tone?: "done" | "waiting" | "skipped" | "pending" | "rejected";
};

export type CanvasEdge = { fromStepOrder: number | null; toStepOrder: number };

const W = 168;
const H = 64;

function place(step: CanvasStep): { x: number; y: number } {
  return {
    x: step.layoutX ?? 24,
    y: step.layoutY ?? (step.stepOrder - 1) * 96 + 16,
  };
}

export function RouteCanvas({
  steps,
  edges,
  editable,
  onMove,
}: {
  steps: CanvasStep[];
  edges: CanvasEdge[];
  editable?: boolean;
  onMove?: (stepOrder: number, x: number, y: number) => void;
}) {
  const [drag, setDrag] = useState<{ order: number; dx: number; dy: number } | null>(null);
  const [live, setLive] = useState<{ order: number; x: number; y: number } | null>(null);
  const board = useRef<SVGSVGElement>(null);
  const points = useMemo(() => {
    const map = new Map<number, { x: number; y: number }>();
    for (const step of steps) {
      const at = place(step);
      map.set(step.stepOrder, live?.order === step.stepOrder ? { x: live.x, y: live.y } : at);
    }
    return map;
  }, [steps, live]);
  const height = Math.max(180, ...[...points.values()].map((p) => p.y + H + 24));

  function tone(step: CanvasStep): string {
    if (step.tone === "done") return "#d1fae5";
    if (step.tone === "waiting") return "#fef3c7";
    if (step.tone === "skipped") return "#e5e7eb";
    if (step.tone === "rejected") return "#fee2e2";
    return "#ffffff";
  }

  return (
    <svg
      ref={board}
      className="w-full rounded border border-slate-200 bg-slate-50"
      height={height}
      onPointerMove={(event) => {
        if (!drag || !board.current) return;
        const rect = board.current.getBoundingClientRect();
        setLive({
          order: drag.order,
          x: Math.max(0, event.clientX - rect.left - drag.dx),
          y: Math.max(0, event.clientY - rect.top - drag.dy),
        });
      }}
      onPointerUp={() => {
        if (drag && live) onMove?.(drag.order, Math.round(live.x), Math.round(live.y));
        setDrag(null);
        setLive(null);
      }}
    >
      {edges.map((edge) => {
        const to = points.get(edge.toStepOrder);
        if (!to) return null;
        const from = edge.fromStepOrder == null ? { x: to.x + W / 2, y: 0 } : points.get(edge.fromStepOrder);
        if (!from) return null;
        const x1 = edge.fromStepOrder == null ? from.x : from.x + W / 2;
        const y1 = edge.fromStepOrder == null ? 8 : from.y + H;
        return (
          <line
            key={`${edge.fromStepOrder ?? "start"}-${edge.toStepOrder}`}
            x1={x1}
            y1={y1}
            x2={to.x + W / 2}
            y2={to.y}
            stroke="#64748b"
            strokeWidth={1.5}
          />
        );
      })}
      {steps.map((step) => {
        const at = points.get(step.stepOrder);
        if (!at) return null;
        return (
          <g
            key={step.stepOrder}
            transform={`translate(${at.x} ${at.y})`}
            onPointerDown={(event) => {
              if (!editable) return;
              board.current?.setPointerCapture(event.pointerId);
              const rect = (event.currentTarget as SVGGElement).getBoundingClientRect();
              setDrag({ order: step.stepOrder, dx: event.clientX - rect.left, dy: event.clientY - rect.top });
            }}
            style={{ cursor: editable ? "grab" : "default" }}
          >
            <rect width={W} height={H} rx={8} fill={tone(step)} stroke="#334155" />
            <text x={8} y={22} fontSize={12} fontWeight={600}>{step.label}</text>
            <text x={8} y={42} fontSize={11} fill="#334155">{step.detail.slice(0, 28)}</text>
          </g>
        );
      })}
    </svg>
  );
}
