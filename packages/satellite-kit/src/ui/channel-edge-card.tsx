"use client";

import { GHOST_BUTTON_CLASS } from "./tokens/components";

export type ChannelEdgeCardProps = {
  title: string;
  kindLabel: string;
  managedLabel: string;
  enabled: boolean;
  onLabel: string;
  offLabel: string;
  /** Technical keys under the title (optional). */
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * One integration-channel row for SA / SatAdmin links screens.
 * Display-only chips — not a CatalogField pick-list.
 */
export function ChannelEdgeCard({
  title,
  kindLabel,
  managedLabel,
  enabled,
  onLabel,
  offLabel,
  detail,
  actionLabel,
  onAction,
}: ChannelEdgeCardProps) {
  return (
    <li className="rounded-lg border border-[#EBEDF0] bg-white px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium text-[#34495E]">{title}</p>
          {detail ? (
            <p className="font-mono text-[11px] text-[#95A5A6]">{detail}</p>
          ) : null}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <span className="rounded-full bg-[#EEF2F7] px-2 py-0.5 text-[11px] font-medium text-[#475569]">
              {kindLabel}
            </span>
            <span
              className={
                enabled
                  ? "rounded-full bg-[#E8F8F0] px-2 py-0.5 text-[11px] font-medium text-[#1E8449]"
                  : "rounded-full bg-[#FDEDEC] px-2 py-0.5 text-[11px] font-medium text-[#C0392B]"
              }
            >
              {enabled ? onLabel : offLabel}
            </span>
            <span className="rounded-full bg-[#F4F6F7] px-2 py-0.5 text-[11px] text-[#7F8C8D]">
              {managedLabel}
            </span>
          </div>
        </div>
        {actionLabel && onAction ? (
          <button type="button" className={GHOST_BUTTON_CLASS} onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>
    </li>
  );
}
