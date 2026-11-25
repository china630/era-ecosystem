"use client";

import { useTranslations } from "next-intl";
import { ProjectMvpOps } from "@/components/ProjectMvpOps";
import { ProjectWave3Depth } from "@/components/ProjectWave3Depth";
import { ProjectStructureOps } from "@/components/ProjectStructureOps";
import { ProjectScheduleOps } from "@/components/ProjectScheduleOps";
import { ProjectEquipmentOps } from "@/components/ProjectEquipmentOps";
import { ProjectClaimsOps } from "@/components/ProjectClaimsOps";
import { ProjectEstimateOps } from "@/components/ProjectEstimateOps";

export type ProjectHubTab =
  | "overview"
  | "estimate"
  | "ops"
  | "depth"
  | "structure"
  | "schedule"
  | "equipment"
  | "claims";

const TABS: ProjectHubTab[] = [
  "overview",
  "estimate",
  "ops",
  "depth",
  "structure",
  "schedule",
  "equipment",
  "claims",
];

export function ProjectHub({
  projectId,
  tab,
  onTabChange,
  overview,
  onOpsChanged,
}: {
  projectId: string;
  tab: ProjectHubTab;
  onTabChange: (tab: ProjectHubTab) => void;
  overview: React.ReactNode;
  onOpsChanged?: () => void;
}) {
  const t = useTranslations("projectsDetail.hub");

  return (
    <div className="space-y-4">
      <p className="rounded border border-[#D6EAF8] bg-[#EBF5FB] p-3 text-[12px] text-[#1A5276]">
        {t("planeNotice")}
      </p>
      <nav className="flex flex-wrap gap-2 border-b pb-2" aria-label={t("navLabel")}>
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            className={
              tab === key
                ? "rounded bg-[#2C3E50] px-3 py-1.5 text-[12px] font-medium text-white"
                : "rounded border px-3 py-1.5 text-[12px] text-[#2C3E50] hover:bg-[#F4F6F7]"
            }
            onClick={() => onTabChange(key)}
          >
            {t(`tab.${key}`)}
          </button>
        ))}
      </nav>
      {tab === "overview" ? overview : null}
      {tab === "estimate" ? (
        <ProjectEstimateOps projectId={projectId} onChanged={onOpsChanged} />
      ) : null}
      {tab === "ops" ? <ProjectMvpOps projectId={projectId} onChanged={onOpsChanged} /> : null}
      {tab === "depth" ? <ProjectWave3Depth projectId={projectId} /> : null}
      {tab === "structure" ? <ProjectStructureOps projectId={projectId} /> : null}
      {tab === "schedule" ? <ProjectScheduleOps projectId={projectId} /> : null}
      {tab === "equipment" ? <ProjectEquipmentOps projectId={projectId} /> : null}
      {tab === "claims" ? <ProjectClaimsOps projectId={projectId} /> : null}
    </div>
  );
}
