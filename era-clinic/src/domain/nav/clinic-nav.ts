import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Stethoscope,
  FlaskConical,
  HeartPulse,
  Settings,
  UserRound,
  Syringe,
  ListOrdered,
  Wallet,
  BedDouble,
  FileSpreadsheet,
  FileInput,
  GitBranch,
  Users,
  Database,
  BookOpen,
  Beaker,
  ScrollText,
  Shield,
  ClipboardList,
  Activity,
  Wrench,
  Grid3x3,
} from "lucide-react";
import type { EraOpsNavItem, EraOpsNavSection } from "@era/satellite-kit/ui";
import { CLINIC_ROLE, type ClinicRoleCode } from "@/lib/clinic-roles";
import { CLINIC_PRESET, type ClinicPresetCode } from "@/domain/presets/clinic-presets";

export type ClinicNavGroupId =
  | "frontdesk"
  | "clinical"
  | "setup:catalogs"
  | "setup:rules"
  | "platform"
  | "mod:sanatorium"
  | "mod:inpatient"
  | "mod:wellness";

export type ClinicNavEntry = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  group: ClinicNavGroupId;
  /** When set, only these roles see the item (unless `seesAll`). */
  roles?: ClinicRoleCode[];
  /** Extra gate on top of the group's module preset. */
  preset?: ClinicPresetCode;
  /** Requires canViewClinicAdmin || isPlatformSuperAdmin. */
  adminOnly?: boolean;
};

export type ClinicNavBuildCtx = {
  role: string;
  seesAll: boolean;
  presetEnabled: (code: ClinicPresetCode) => boolean;
};

type NavTranslator = (key: string) => string;

const GROUP_ORDER: ClinicNavGroupId[] = [
  "frontdesk",
  "clinical",
  "mod:sanatorium",
  "mod:inpatient",
  "mod:wellness",
  "setup:catalogs",
  "setup:rules",
  "platform",
];

const GROUP_META: Record<
  ClinicNavGroupId,
  { titleKey: string; icon: LucideIcon; modulePreset?: ClinicPresetCode }
> = {
  frontdesk: { titleKey: "sectionFrontdesk", icon: ClipboardList },
  clinical: { titleKey: "sectionClinical", icon: Activity },
  "mod:sanatorium": {
    titleKey: "moduleSanatorium",
    icon: HeartPulse,
    modulePreset: CLINIC_PRESET.SANATORIUM_CLINICAL,
  },
  "mod:inpatient": {
    titleKey: "moduleInpatient",
    icon: BedDouble,
    modulePreset: CLINIC_PRESET.INPATIENT_DAY,
  },
  "mod:wellness": {
    titleKey: "moduleWellness",
    icon: HeartPulse,
    modulePreset: CLINIC_PRESET.WELLNESS,
  },
  "setup:catalogs": { titleKey: "sectionCatalogs", icon: BookOpen },
  "setup:rules": { titleKey: "sectionRules", icon: Wrench },
  platform: { titleKey: "sectionPlatform", icon: Shield },
};

/** Flat links above collapsible sections (all authenticated users). */
export const CLINIC_TOP_NAV: ClinicNavEntry[] = [
  { href: "/", labelKey: "home", icon: LayoutDashboard, group: "frontdesk" },
  { href: "/patients", labelKey: "patients", icon: Users, group: "frontdesk" },
];

export const CLINIC_NAV: ClinicNavEntry[] = [
  // Front desk — RECEPTION
  {
    href: "/appointments",
    labelKey: "appointments",
    icon: Stethoscope,
    group: "frontdesk",
    roles: [CLINIC_ROLE.RECEPTION],
  },
  {
    href: "/reception/queue",
    labelKey: "queue",
    icon: ListOrdered,
    group: "frontdesk",
    roles: [CLINIC_ROLE.RECEPTION],
  },
  {
    href: "/cashier",
    labelKey: "cashier",
    icon: Wallet,
    group: "frontdesk",
    roles: [CLINIC_ROLE.RECEPTION],
  },

  // Clinical — DOCTOR / NURSE
  {
    href: "/doctor",
    labelKey: "doctor",
    icon: UserRound,
    group: "clinical",
    roles: [CLINIC_ROLE.DOCTOR],
  },
  {
    href: "/nurse",
    labelKey: "nurse",
    icon: Syringe,
    group: "clinical",
    roles: [CLINIC_ROLE.NURSE],
  },
  {
    href: "/lab-orders",
    labelKey: "labOrders",
    icon: FlaskConical,
    group: "clinical",
    roles: [CLINIC_ROLE.DOCTOR, CLINIC_ROLE.NURSE],
  },

  // Module: Sanatoriya
  {
    href: "/sanatorium",
    labelKey: "sanatorium",
    icon: HeartPulse,
    group: "mod:sanatorium",
    roles: [CLINIC_ROLE.RECEPTION, CLINIC_ROLE.DOCTOR],
    preset: CLINIC_PRESET.SANATORIUM_CLINICAL,
  },
  {
    href: "/sanatorium/resources",
    labelKey: "resourceMatrix",
    icon: Grid3x3,
    group: "mod:sanatorium",
    roles: [CLINIC_ROLE.RECEPTION],
    preset: CLINIC_PRESET.SANATORIUM_CLINICAL,
  },

  // Module: Stasionar
  {
    href: "/inpatient",
    labelKey: "inpatient",
    icon: BedDouble,
    group: "mod:inpatient",
    roles: [CLINIC_ROLE.RECEPTION, CLINIC_ROLE.DOCTOR, CLINIC_ROLE.NURSE],
    preset: CLINIC_PRESET.INPATIENT_DAY,
  },
  {
    href: "/inpatient/census",
    labelKey: "inpatientCensus",
    icon: ClipboardList,
    group: "mod:inpatient",
    roles: [CLINIC_ROLE.RECEPTION, CLINIC_ROLE.DOCTOR, CLINIC_ROLE.NURSE],
    preset: CLINIC_PRESET.INPATIENT_DAY,
  },
  {
    href: "/admin/wards",
    labelKey: "wardsAdmin",
    icon: BedDouble,
    group: "mod:inpatient",
    adminOnly: true,
    preset: CLINIC_PRESET.INPATIENT_DAY,
  },

  // Setup — Catalogs (admin/owner)
  {
    href: "/admin/catalog",
    labelKey: "catalog",
    icon: BookOpen,
    group: "setup:catalogs",
    adminOnly: true,
  },
  {
    href: "/admin/diagnostic-catalog",
    labelKey: "diagnosticCatalog",
    icon: Beaker,
    group: "setup:catalogs",
    adminOnly: true,
  },
  {
    href: "/admin/templates",
    labelKey: "templates",
    icon: FileSpreadsheet,
    group: "setup:catalogs",
    adminOnly: true,
  },

  // Setup — Rules & data (admin/owner)
  {
    href: "/admin/procedure-rules",
    labelKey: "procedureRules",
    icon: GitBranch,
    group: "setup:rules",
    adminOnly: true,
  },
  {
    href: "/admin/lis-profiles",
    labelKey: "lisProfiles",
    icon: FileInput,
    group: "setup:rules",
    adminOnly: true,
  },
  {
    href: "/admin/master-data",
    labelKey: "masterData",
    icon: Database,
    group: "setup:rules",
    adminOnly: true,
  },
  {
    href: "/admin/lookups",
    labelKey: "lookups",
    icon: BookOpen,
    group: "setup:catalogs",
    adminOnly: true,
  },
  {
    href: "/admin/audit",
    labelKey: "audit",
    icon: ScrollText,
    group: "platform",
    adminOnly: true,
  },
  {
    href: "/admin/settings",
    labelKey: "settings",
    icon: Settings,
    group: "platform",
    adminOnly: true,
  },
];

function entryVisible(entry: ClinicNavEntry, ctx: ClinicNavBuildCtx): boolean {
  if (entry.preset && !ctx.presetEnabled(entry.preset)) return false;
  if (entry.adminOnly && !ctx.seesAll) return false;
  if (ctx.seesAll) return true;
  if (!entry.roles || entry.roles.length === 0) return true;
  return entry.roles.includes(ctx.role as ClinicRoleCode);
}

function toNavItem(entry: ClinicNavEntry, t: NavTranslator): EraOpsNavItem {
  return {
    href: entry.href,
    label: t(entry.labelKey),
    icon: entry.icon,
  };
}

export function buildClinicNav(
  ctx: ClinicNavBuildCtx,
  t: NavTranslator,
): { topItems: EraOpsNavItem[]; sections: EraOpsNavSection[] } {
  const topItems = CLINIC_TOP_NAV.map((e) => toNavItem(e, t));

  const visible = CLINIC_NAV.filter((e) => entryVisible(e, ctx));
  const byGroup = new Map<ClinicNavGroupId, EraOpsNavItem[]>();
  for (const entry of visible) {
    const list = byGroup.get(entry.group) ?? [];
    list.push(toNavItem(entry, t));
    byGroup.set(entry.group, list);
  }

  const sections: EraOpsNavSection[] = [];
  for (const groupId of GROUP_ORDER) {
    const meta = GROUP_META[groupId];
    if (meta.modulePreset && !ctx.presetEnabled(meta.modulePreset)) continue;
    const items = byGroup.get(groupId);
    if (!items || items.length === 0) continue;
    sections.push({
      id: groupId,
      title: t(meta.titleKey),
      icon: meta.icon,
      items,
    });
  }

  return { topItems, sections };
}
