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
  Package,
  FileInput,
  GitBranch,
  Users,
  Database,
  BookOpen,
  MapPin,
  Beaker,
  ScrollText,
  Shield,
  ClipboardList,
  Activity,
  Wrench,
  Grid3x3,
  CalendarRange,
  Trash2,
} from "lucide-react";
import type { EraOpsNavItem, EraOpsNavSection } from "@era/satellite-kit/ui";
import {
  opsNavProfileFromMe,
  visibleOpsNavItems,
  visibleOpsNavSections,
  type OpsNavCondition,
} from "@era/satellite-kit/ui/nav";
import { CLINIC_PRESET, type ClinicPresetCode } from "@/domain/presets/clinic-presets";
import {
  CLINIC_PERMISSION,
  type ClinicPermission,
} from "@/lib/auth/clinic-permissions";

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
  /** When set, only sessions with this permission see the item. */
  permission?: ClinicPermission;
  /**
   * Visible when any listed preset is on.
   * Omit for the shared core (home, patients, lab, catalogs, platform).
   */
  preset?: readonly ClinicPresetCode[];
};

export type ClinicNavItem = EraOpsNavItem & OpsNavCondition;
export type ClinicNavSection = Omit<EraOpsNavSection, "items"> &
  OpsNavCondition & { items: ClinicNavItem[] };

export type ClinicNavBuildCtx = {
  permissions: string[];
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
  { href: "/", labelKey: "home", icon: LayoutDashboard, group: "frontdesk", permission: CLINIC_PERMISSION.SCREEN_HOME },
  { href: "/patients", labelKey: "patients", icon: Users, group: "frontdesk", permission: CLINIC_PERMISSION.SCREEN_PATIENTS },
];

export const CLINIC_NAV: ClinicNavEntry[] = [
  // Front desk — RECEPTION
  {
    href: "/appointments",
    labelKey: "appointments",
    icon: Stethoscope,
    group: "frontdesk",
    permission: CLINIC_PERMISSION.SCREEN_APPOINTMENTS,
    preset: [CLINIC_PRESET.OUTPATIENT, CLINIC_PRESET.SANATORIUM_CLINICAL],
  },
  {
    href: "/reception/queue",
    labelKey: "queue",
    icon: ListOrdered,
    group: "frontdesk",
    permission: CLINIC_PERMISSION.SCREEN_RECEPTION_QUEUE,
    preset: [CLINIC_PRESET.OUTPATIENT],
  },
  {
    href: "/cashier",
    labelKey: "cashier",
    icon: Wallet,
    group: "frontdesk",
    permission: CLINIC_PERMISSION.SCREEN_CASHIER,
    preset: [CLINIC_PRESET.OUTPATIENT],
  },
  {
    href: "/reception/extra-tickets",
    labelKey: "extraTickets",
    icon: ScrollText,
    group: "frontdesk",
    permission: CLINIC_PERMISSION.SCREEN_RECEPTION_EXTRA_TICKETS,
    preset: [CLINIC_PRESET.SANATORIUM_CLINICAL],
  },

  // Clinical — DOCTOR / NURSE
  {
    href: "/doctor",
    labelKey: "doctor",
    icon: UserRound,
    group: "clinical",
    permission: CLINIC_PERMISSION.SCREEN_DOCTOR,
    preset: [CLINIC_PRESET.OUTPATIENT],
  },
  {
    href: "/nurse",
    labelKey: "nurse",
    icon: Syringe,
    group: "clinical",
    permission: CLINIC_PERMISSION.SCREEN_NURSE,
    preset: [CLINIC_PRESET.SANATORIUM_CLINICAL],
  },
  {
    href: "/check-in",
    labelKey: "checkIn",
    icon: ClipboardList,
    group: "clinical",
    permission: CLINIC_PERMISSION.SCREEN_CHECK_IN,
    preset: [CLINIC_PRESET.SANATORIUM_CLINICAL],
  },
  {
    href: "/lab-orders",
    labelKey: "labOrders",
    icon: FlaskConical,
    group: "clinical",
    permission: CLINIC_PERMISSION.SCREEN_LAB_ORDERS,
  },
  {
    href: "/reports/diagnoses",
    labelKey: "diagnosisReport",
    icon: FileSpreadsheet,
    group: "clinical",
    permission: CLINIC_PERMISSION.SCREEN_REPORTS_DIAGNOSES,
  },
  {
    href: "/reports/procedures",
    labelKey: "procedureReport",
    icon: FileSpreadsheet,
    group: "clinical",
    permission: CLINIC_PERMISSION.SCREEN_REPORTS_PROCEDURES,
    preset: [CLINIC_PRESET.SANATORIUM_CLINICAL],
  },

  // Module: Sanatoriya
  {
    href: "/sanatorium",
    labelKey: "sanatorium",
    icon: HeartPulse,
    group: "mod:sanatorium",
    permission: CLINIC_PERMISSION.SCREEN_SANATORIUM,
    preset: [CLINIC_PRESET.SANATORIUM_CLINICAL],
  },
  {
    href: "/sanatorium/resources",
    labelKey: "resourceMatrix",
    icon: Grid3x3,
    group: "mod:sanatorium",
    permission: CLINIC_PERMISSION.SCREEN_SANATORIUM_RESOURCES,
    preset: [CLINIC_PRESET.SANATORIUM_CLINICAL],
  },
  {
    href: "/sanatorium/nurse-roster",
    labelKey: "nurseRoster",
    icon: CalendarRange,
    group: "mod:sanatorium",
    permission: CLINIC_PERMISSION.SCREEN_SANATORIUM_NURSE_ROSTER,
    preset: [CLINIC_PRESET.SANATORIUM_CLINICAL],
  },

  // Module: Stasionar
  {
    href: "/inpatient",
    labelKey: "inpatient",
    icon: BedDouble,
    group: "mod:inpatient",
    permission: CLINIC_PERMISSION.SCREEN_INPATIENT,
    preset: [CLINIC_PRESET.INPATIENT_DAY],
  },
  {
    href: "/inpatient/census",
    labelKey: "inpatientCensus",
    icon: ClipboardList,
    group: "mod:inpatient",
    permission: CLINIC_PERMISSION.SCREEN_INPATIENT_CENSUS,
    preset: [CLINIC_PRESET.INPATIENT_DAY],
  },
  {
    href: "/admin/wards",
    labelKey: "wardsAdmin",
    icon: BedDouble,
    group: "mod:inpatient",
    permission: CLINIC_PERMISSION.SCREEN_ADMIN_WARDS,
    preset: [CLINIC_PRESET.INPATIENT_DAY],
  },

  // Setup — Catalogs (admin/owner)
  {
    href: "/admin/catalog",
    labelKey: "catalog",
    icon: BookOpen,
    group: "setup:catalogs",
    permission: CLINIC_PERMISSION.SCREEN_ADMIN_CATALOG,
  },
  {
    href: "/admin/diagnostic-catalog",
    labelKey: "diagnosticCatalog",
    icon: Beaker,
    group: "setup:catalogs",
    permission: CLINIC_PERMISSION.SCREEN_ADMIN_DIAGNOSTIC_CATALOG,
  },
  {
    href: "/admin/icd-favorites",
    labelKey: "icdFavorites",
    icon: BookOpen,
    group: "setup:catalogs",
    permission: CLINIC_PERMISSION.SCREEN_ADMIN_ICD_FAVORITES,
  },
  {
    href: "/admin/program-templates",
    labelKey: "sanatoriumPackages",
    icon: Package,
    group: "setup:catalogs",
    permission: CLINIC_PERMISSION.SCREEN_ADMIN_PROGRAM_TEMPLATES,
    preset: [CLINIC_PRESET.SANATORIUM_CLINICAL],
  },
  {
    href: "/admin/import",
    labelKey: "cutoverImport",
    icon: FileInput,
    group: "setup:catalogs",
    permission: CLINIC_PERMISSION.SCREEN_ADMIN_IMPORT,
    preset: [CLINIC_PRESET.SANATORIUM_CLINICAL],
  },

  // Setup — Rules & data (admin/owner)
  {
    href: "/admin/procedure-rules",
    labelKey: "procedureRules",
    icon: GitBranch,
    group: "setup:rules",
    permission: CLINIC_PERMISSION.SCREEN_ADMIN_PROCEDURE_RULES,
    preset: [CLINIC_PRESET.SANATORIUM_CLINICAL],
  },
  {
    href: "/admin/lis-profiles",
    labelKey: "lisProfiles",
    icon: FileInput,
    group: "setup:rules",
    permission: CLINIC_PERMISSION.SCREEN_ADMIN_LIS_PROFILES,
  },
  {
    href: "/admin/master-data",
    labelKey: "masterData",
    icon: Database,
    group: "setup:rules",
    permission: CLINIC_PERMISSION.SCREEN_ADMIN_MASTER_DATA,
  },
  {
    href: "/admin/lookups",
    labelKey: "lookups",
    icon: BookOpen,
    group: "setup:catalogs",
    permission: CLINIC_PERMISSION.SCREEN_ADMIN_LOOKUPS,
    preset: [CLINIC_PRESET.SANATORIUM_CLINICAL],
  },
  {
    href: "/admin/physio-sites",
    labelKey: "physioSites",
    icon: MapPin,
    group: "setup:catalogs",
    permission: CLINIC_PERMISSION.SCREEN_ADMIN_PHYSIO_SITES,
    preset: [CLINIC_PRESET.SANATORIUM_CLINICAL],
  },
  {
    href: "/admin/ops-wipe",
    labelKey: "opsWipe",
    icon: Trash2,
    group: "platform",
    permission: CLINIC_PERMISSION.SCREEN_ADMIN_SETTINGS,
  },
  {
    href: "/admin/audit",
    labelKey: "audit",
    icon: ScrollText,
    group: "platform",
    permission: CLINIC_PERMISSION.SCREEN_ADMIN_AUDIT,
  },
  {
    href: "/admin/settings",
    labelKey: "settings",
    icon: Settings,
    group: "platform",
    permission: CLINIC_PERMISSION.SCREEN_ADMIN_SETTINGS,
  },
  {
    href: "/admin/access",
    labelKey: "accessControl",
    icon: Shield,
    group: "platform",
    permission: CLINIC_PERMISSION.SCREEN_ADMIN_ACCESS,
  },
];

function toNavItem(entry: ClinicNavEntry, t: NavTranslator): ClinicNavItem {
  return {
    href: entry.href,
    label: t(entry.labelKey),
    icon: entry.icon,
    permission: entry.permission,
    preset: entry.preset,
  };
}

/** Full catalog with row and section conditions; the shell filters it with the kit. */
export function clinicNavCatalog(t: NavTranslator): {
  topItems: ClinicNavItem[];
  sections: ClinicNavSection[];
} {
  const topItems = CLINIC_TOP_NAV.map((e) => toNavItem(e, t));
  const byGroup = new Map<ClinicNavGroupId, ClinicNavItem[]>();
  for (const entry of CLINIC_NAV) {
    const list = byGroup.get(entry.group) ?? [];
    list.push(toNavItem(entry, t));
    byGroup.set(entry.group, list);
  }
  const sections: ClinicNavSection[] = [];
  for (const groupId of GROUP_ORDER) {
    const meta = GROUP_META[groupId];
    const items = byGroup.get(groupId);
    if (!items || items.length === 0) continue;
    sections.push({
      id: groupId,
      title: t(meta.titleKey),
      icon: meta.icon,
      ...(meta.modulePreset ? { preset: meta.modulePreset } : {}),
      items,
    });
  }
  return { topItems, sections };
}

export function buildClinicNav(
  ctx: ClinicNavBuildCtx,
  t: NavTranslator,
): { topItems: EraOpsNavItem[]; sections: EraOpsNavSection[] } {
  const profile = opsNavProfileFromMe({
    permissions: ctx.permissions,
    enabledPresets: Object.values(CLINIC_PRESET).filter((code) => ctx.presetEnabled(code)),
  });
  const catalog = clinicNavCatalog(t);
  return {
    topItems: visibleOpsNavItems(catalog.topItems, "ready", profile),
    sections: visibleOpsNavSections(catalog.sections, "ready", profile),
  };
}

/** First admin href the session may open (nav order). */
export function firstAllowedAdminHref(permissions: string[]): string | null {
  for (const entry of CLINIC_NAV) {
    if (!entry.permission?.startsWith("screen:admin.")) continue;
    if (permissions.includes(entry.permission)) return entry.href;
  }
  return null;
}
