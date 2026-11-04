import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { URINE_BLANK_PROFILE_NAME, URINE_BLANK_ROWS } from "@/domain/lab/urine-blank-rows";

const STALE_URINE_REF: Record<string, string[]> = {
  "U-SG": ["1.005", "1.010", "1.015"],
  "U-PH": ["5.0", "5"],
  /** Legacy prose wrongly stored in ref_min before norm-sentence wave. */
  "U-COLOR": ["Açıq sarı"],
  "U-CLARITY": ["Şəffaf"],
  "U-KET": ["Neqativ"],
  "U-NIT": ["Neqativ"],
  "U-BIL": ["Neqativ"],
  "U-URO": ["Neqativ"],
  "U-MUCUS": ["Yoxdur"],
  "U-YEAST": ["Yoxdur"],
  "U-BACT": ["Yoxdur"],
  "U-SALT": ["Yoxdur"],
};

function isStaleUrineRef(code: string, refMin: string): boolean {
  return STALE_URINE_REF[code]?.includes(refMin.trim()) ?? false;
}

/** Write the urine blank's order and reference ranges onto LAB-URINE. */
export async function alignUrinePanel(serviceId: string): Promise<void> {
  const service = await prisma.diagnosticService.findUnique({
    where: { id: serviceId },
    select: { code: true, organizationId: true },
  });
  if (service?.code !== "LAB-URINE") return;
  const current = await prisma.diagnosticAnalyte.findMany({
    where: { serviceId, code: { in: URINE_BLANK_ROWS.map((row) => row.code) } },
    select: {
      code: true,
      section: true,
      refMin: true,
      refMax: true,
      unit: true,
      normTextAz: true,
      boundKind: true,
      valueType: true,
    },
  });
  const byCode = new Map(current.map((row) => [row.code, row]));
  for (const row of URINE_BLANK_ROWS) {
    const found = byCode.get(row.code);
    if (!found) continue;
    const data: {
      section?: string;
      refMin?: string | null;
      refMax?: string | null;
      unit?: string;
      normTextEn?: string | null;
      normTextRu?: string | null;
      normTextAz?: string | null;
      boundKind?: "INTERVAL" | "UPPER_ONLY" | "LOWER_ONLY" | "QUALITATIVE" | "ZONES";
      valueType?: "NUMERIC" | "QUALITATIVE";
    } = {};
    if (!found.section) data.section = row.section;

    if (row.boundKind && row.boundKind !== found.boundKind) {
      data.boundKind = row.boundKind;
    }
    if (row.valueType === "QUALITATIVE" && found.valueType !== "QUALITATIVE") {
      data.valueType = "QUALITATIVE";
    }

    if (row.normTextAz && (!found.normTextAz || found.normTextAz.trim() === "")) {
      data.normTextAz = row.normTextAz;
      data.normTextRu = row.normTextRu ?? null;
      data.normTextEn = row.normTextEn ?? null;
    }

    const qualitative = row.boundKind === "QUALITATIVE";
    if (qualitative) {
      if (found.refMin != null && found.refMin !== "") {
        data.refMin = null;
        data.refMax = null;
      }
    } else if (row.boundKind === "UPPER_ONLY") {
      if (row.refMax != null && (found.refMax == null || found.refMax === "" || found.refMin === "0")) {
        data.refMax = row.refMax;
      }
      if (found.refMin != null && found.refMin !== "") {
        data.refMin = null;
      }
    } else if (
      row.refMin != null &&
      (found.refMin == null || found.refMin === "" || isStaleUrineRef(row.code, found.refMin))
    ) {
      data.refMin = row.refMin;
      data.refMax = row.refMax ?? null;
    }

    if (row.unit && (!found.unit || found.unit === "/HPF")) data.unit = row.unit;
    if (Object.keys(data).length === 0) continue;
    await prisma.diagnosticAnalyte.updateMany({ where: { serviceId, code: row.code }, data });
  }
  await ensureUrineBlankProfile(service.organizationId);
}

export async function ensureUrineBlankProfile(organizationId?: string): Promise<void> {
  const orgId = organizationId ?? requestOrganizationId();
  const existing = await prisma.labBlankProfile.findUnique({
    where: { organizationId_name: { organizationId: orgId, name: URINE_BLANK_PROFILE_NAME } },
    select: { id: true },
  });
  if (existing) return;
  const profile = await prisma.labBlankProfile.create({
    data: {
      organizationId: orgId,
      name: URINE_BLANK_PROFILE_NAME,
      kind: "TABLE",
      serviceCode: "LAB-URINE",
      active: true,
    },
  });
  await prisma.labBlankRow.createMany({
    data: URINE_BLANK_ROWS.map((row) => ({
      organizationId: orgId,
      profileId: profile.id,
      sourceLabel: row.label,
      analyteCode: row.code,
      sortOrder: row.sortOrder,
    })),
  });
}
