"use client";

import type { ReactNode } from "react";

export type HeaderTierQuota = {
  key: string;
  label: string;
  current: number;
  max: number | null;
};

export type HeaderTierUsageBarProps = {
  tier: string;
  quotas: HeaderTierQuota[];
  /** Optional badges after tier (trial, read-only). */
  tierSuffix?: ReactNode;
  /** Legacy: separate "Manage" link. Prefer `href` (whole box clickable). */
  manageHref?: string;
  manageLabel?: string;
  /** When set, the entire bar becomes a link (no separate Manage link). */
  href?: string;
  /** Accessible label for the whole-box link. */
  ariaLabel?: string;
  className?: string;
};

function quotaPercent(current: number, max: number | null): number {
  if (max == null || max <= 0) return 0;
  return Math.min(100, Math.round((current / max) * 100));
}

function barColor(percent: number): string {
  if (percent >= 90) return "bg-red-500";
  if (percent >= 70) return "bg-amber-500";
  return "bg-[#2980B9]";
}

function QuotaBar({ quota }: { quota: HeaderTierQuota }) {
  const pct = quotaPercent(quota.current, quota.max);
  const title =
    quota.max != null
      ? `${quota.label}: ${quota.current}/${quota.max} (${pct}%)`
      : `${quota.label}: ${quota.current}`;

  return (
    <div className="flex min-w-[4.5rem] max-w-[7rem] flex-1 flex-col gap-0.5" title={title}>
      <div className="flex items-center justify-between gap-1 text-[10px] text-[#7F8C8D]">
        <span className="truncate">{quota.label}</span>
        {quota.max != null ? (
          <span className="shrink-0 tabular-nums">{pct}%</span>
        ) : null}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#EBEDF0]">
        <div
          className={`h-full rounded-full transition-all ${barColor(pct)}`}
          style={{ width: quota.max != null ? `${pct}%` : "0%" }}
        />
      </div>
    </div>
  );
}

/** Compact tier + color quota bars for app header (Finance + CP-backed satellites). */
export function HeaderTierUsageBar({
  tier,
  quotas,
  tierSuffix,
  manageHref,
  manageLabel,
  href,
  ariaLabel,
  className = "",
}: HeaderTierUsageBarProps) {
  const visible = quotas.filter((q) => q.max != null || q.current > 0);
  if (visible.length === 0 && !tier) return null;

  const inner = (
    <>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#2980B9]/15 bg-[#EBEDF0] px-2 py-1 text-[11px] font-semibold uppercase text-[#34495E]">
        {tier}
        {tierSuffix}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {visible.map((q) => (
          <QuotaBar key={q.key} quota={q} />
        ))}
      </div>
      {!href && manageHref && manageLabel ? (
        <a
          href={manageHref}
          className="shrink-0 text-[11px] font-medium text-[#2980B9] hover:underline"
        >
          {manageLabel}
        </a>
      ) : null}
    </>
  );

  const baseClass = [
    "hidden min-w-0 max-w-[min(100%,420px)] items-center gap-2 sm:flex",
    className,
  ].join(" ");

  if (href) {
    return (
      <a
        href={href}
        aria-label={ariaLabel}
        title={ariaLabel}
        className={[
          baseClass,
          "rounded-md px-1 -mx-1 transition hover:bg-[#2980B9]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2980B9]/40",
        ].join(" ")}
      >
        {inner}
      </a>
    );
  }

  return <div className={baseClass}>{inner}</div>;
}
