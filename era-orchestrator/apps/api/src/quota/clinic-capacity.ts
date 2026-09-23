import {
  clinicCapacityOverage,
  clinicRoomBillableModule,
} from "@era365/database";

export function clinicRoomOverageUnits(
  roomCount: number,
  activeModules: readonly string[],
): { moduleKey: "clinic_sanatorium" | "clinic_registry_emr" | null; overageUnits: number } {
  const moduleKey = clinicRoomBillableModule(activeModules);
  if (!moduleKey) return { moduleKey: null, overageUnits: 0 };
  return { moduleKey, overageUnits: clinicCapacityOverage(roomCount) };
}

export function clinicBedOverageUnits(
  bedCount: number,
  activeModules: readonly string[],
): number {
  const set = new Set(activeModules.map((m) => m.trim()).filter(Boolean));
  if (!set.has("clinic_inpatient")) return 0;
  return clinicCapacityOverage(bedCount);
}
