"use client";

import { SECONDARY_BUTTON_CLASS, DANGER_BUTTON_CLASS } from "./tokens/components";

export type ChannelEdgeCardProps = {
  /** Peer path title (from → to). Secondary to kind + flow. */
  title: string;
  /** Channel kind — primary signal. */
  kindLabel: string;
  /** Short flow description (en/az/ru via caller). */
  flowBlurb?: string;
  managedLabel: string;
  enabled: boolean;
  onLabel: string;
  offLabel: string;
  /** Technical keys under the peer title (optional, mono). */
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Explicit enable/disable control — not ghost. */
  actionTone?: "secondary" | "danger";
};

/**
 * One integration-channel row for SA / SatAdmin links screens.
 * Kind + flow blurb are the main signal; keys and managed chips are secondary.
 * Display-only chips — not a CatalogField pick-list.
 */
export function ChannelEdgeCard({
  title,
  kindLabel,
  flowBlurb,
  managedLabel,
  enabled,
  onLabel,
  offLabel,
  detail,
  actionLabel,
  onAction,
  actionTone = "secondary",
}: ChannelEdgeCardProps) {
  const actionClass =
    actionTone === "danger" ? DANGER_BUTTON_CLASS : SECONDARY_BUTTON_CLASS;

  return (
    <li className="rounded-lg border border-[#EBEDF0] bg-white px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[#34495E]">{kindLabel}</p>
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
          {flowBlurb ? (
            <p className="text-sm leading-snug text-[#5D6D7E]">{flowBlurb}</p>
          ) : null}
          <p className="text-xs text-[#7F8C8D]">{title}</p>
          {detail ? (
            <p className="font-mono text-[11px] text-[#95A5A6]">{detail}</p>
          ) : null}
        </div>
        {actionLabel && onAction ? (
          <button type="button" className={actionClass} onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>
    </li>
  );
}
