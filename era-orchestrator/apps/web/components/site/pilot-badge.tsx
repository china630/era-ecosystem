import type { SiteNavLabels } from "../../lib/i18n/site-nav-copy";

export function PilotBadge({ label }: { label: SiteNavLabels["pilot"] }) {
  return (
    <span className="ml-1.5 inline-flex rounded-full border border-[#2980B9]/25 bg-[#EBF5FB] px-2 py-0.5 text-[10px] font-medium text-[#2471A3]">
      {label}
    </span>
  );
}