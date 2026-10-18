import { prisma } from "@/lib/prisma";
import { extractBlankTable, extractDocxParagraphs, isFilledBlankValue, type BlankTableRow } from "@/domain/lab/blank-docx";
import { parseUsmSections, usmBlankKind, usmFieldsOmitted } from "@/domain/lab/usm-blank";

export type BlankPreviewRow = {
  label: string;
  value: string;
  norm: string;
  analyteCode: string | null;
  applied: boolean;
};

/**
 * Map a Word table onto this order's panel.
 * A value is written only when the label is mapped and that code is on this order.
 * Anything else stays in the preview and is left out.
 */
export async function previewBlankForOrder(input: {
  orderId: string;
  profileId: string;
  docx: Buffer;
}): Promise<BlankPreviewRow[]> {
  const [order, profile] = await Promise.all([
    prisma.labOrder.findUnique({
      where: { id: input.orderId },
      include: { items: { include: { diagnosticService: { include: { analytes: true } } } } },
    }),
    prisma.labBlankProfile.findUnique({
      where: { id: input.profileId },
      include: { rows: true },
    }),
  ]);
  if (!order || !profile) return [];
  const allowed = new Set<string>();
  for (const item of order.items) {
    const panelCode = profile.serviceCode;
    const service = item.diagnosticService;
    const samePanel =
      !panelCode ||
      item.serviceCode === panelCode ||
      service?.code === panelCode ||
      service?.serviceCode === panelCode;
    if (!samePanel) continue;
    for (const analyte of item.diagnosticService?.analytes ?? []) {
      allowed.add(analyte.code);
      if (analyte.cardId) {
        const card = await prisma.analyteCard.findUnique({ where: { id: analyte.cardId }, select: { code: true } });
        if (card) allowed.add(card.code);
      }
    }
  }
  const byLabel = new Map(profile.rows.map((row) => [row.sourceLabel.trim().toLowerCase(), row.analyteCode]));
  return extractBlankTable(input.docx).map((row) => mappedRow(row, byLabel, allowed));
}

function mappedRow(
  row: BlankTableRow,
  byLabel: Map<string, string>,
  allowed: Set<string>,
): BlankPreviewRow {
  const analyteCode = byLabel.get(row.label.trim().toLowerCase()) ?? null;
  const filled = isFilledBlankValue(row.value);
  const applied = Boolean(analyteCode && filled && allowed.has(analyteCode));
  return { label: row.label, value: row.value, norm: row.norm, analyteCode, applied };
}

/**
 * Lab panels use the blank whose serviceCode is this order.
 * Ultrasound panels use the narrative headings for that study. Patient sex drops the other abdomen organs.
 */
export async function previewWordForOrder(input: {
  orderId: string;
  docx: Buffer;
  profileId?: string;
}): Promise<
  | { mode: "rows"; rows: BlankPreviewRow[] }
  | { mode: "fields"; fields: Record<string, string>; omit: string[] }
  | { mode: "missing" }
  | null
> {
  const order = await prisma.labOrder.findUnique({
    where: { id: input.orderId },
    include: {
      patientRef: { select: { sex: true } },
      items: { select: { serviceCode: true } },
    },
  });
  if (!order) return null;
  const serviceCode = order.items[0]?.serviceCode ?? "";
  const kind = usmBlankKind(serviceCode);
  if (kind) {
    const narrative = parseUsmSections(extractDocxParagraphs(input.docx), {
      kind,
      sex: order.patientRef.sex,
    });
    if (Object.keys(narrative).length > 0) {
      return {
        mode: "fields",
        fields: narrative,
        omit: usmFieldsOmitted(order.patientRef.sex),
      };
    }
  }
  const codes = order.items.map((item) => item.serviceCode).filter(Boolean);
  const services = codes.length
    ? await prisma.diagnosticService.findMany({
        where: { OR: [{ code: { in: codes } }, { serviceCode: { in: codes } }] },
        select: { code: true, serviceCode: true },
      })
    : [];
  const keys = [
    ...new Set([
      ...codes,
      ...services.flatMap((row) => [row.code, row.serviceCode].filter(Boolean)),
    ]),
  ];
  const profile = input.profileId
    ? await prisma.labBlankProfile.findUnique({
        where: { id: input.profileId },
        include: { rows: true },
      })
    : await prisma.labBlankProfile.findFirst({
        where: { active: true, serviceCode: { in: keys.length ? keys : ["__none__"] } },
        include: { rows: true },
        orderBy: { name: "asc" },
      });
  if (!profile) return { mode: "missing" };
  const rows = await previewBlankForOrder({
    orderId: input.orderId,
    profileId: profile.id,
    docx: input.docx,
  });
  if (rows.some((row) => row.applied)) return { mode: "rows", rows };
  const withFields = keys.length
    ? await prisma.diagnosticService.findMany({
        where: { OR: [{ code: { in: keys } }, { serviceCode: { in: keys } }] },
        select: { fieldsJson: true },
      })
    : [];
  const fieldKeys = new Set(withFields.flatMap((row) => fieldKeysOf(row.fieldsJson)));
  const fields = fieldsFromBlank(input.docx, profile.rows, fieldKeys);
  if (Object.keys(fields).length > 0) return { mode: "fields", fields, omit: [] };
  return { mode: "rows", rows };
}

function fieldKeysOf(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => {
        if (!row || typeof row !== "object") return "";
        const rec = row as { key?: unknown; code?: unknown };
        return String(rec.key ?? rec.code ?? "").trim();
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function fieldsFromBlank(
  docx: Buffer,
  rows: Array<{ sourceLabel: string; analyteCode: string }>,
  fieldKeys: Set<string>,
): Record<string, string> {
  if (fieldKeys.size === 0) return {};
  const byLabel = new Map(
    rows.map((row) => [row.sourceLabel.trim().toLowerCase(), row.analyteCode]),
  );
  const fields: Record<string, string> = {};
  for (const row of extractBlankTable(docx)) {
    const key = byLabel.get(row.label.trim().toLowerCase());
    if (!key || !fieldKeys.has(key) || !isFilledBlankValue(row.value)) continue;
    fields[key] = row.value;
  }
  return fields;
}

function blankRows(input: Array<{ sourceLabel: string; analyteCode: string }>) {
  const byLabel = new Map<string, { sourceLabel: string; analyteCode: string }>();
  for (const row of input) {
    const sourceLabel = row.sourceLabel.trim();
    const analyteCode = row.analyteCode.trim();
    if (!sourceLabel || !analyteCode) continue;
    byLabel.set(sourceLabel, { sourceLabel, analyteCode });
  }
  return [...byLabel.values()];
}

/** Create a Word blank, or replace the one with this id or the same name. */
export async function saveBlankProfile(input: {
  id?: string;
  name: string;
  kind: "TABLE" | "NARRATIVE";
  serviceCode?: string | null;
  rows: Array<{ sourceLabel: string; analyteCode: string }>;
}) {
  const name = input.name.trim();
  const rows = blankRows(input.rows);
  const existing = input.id
    ? await prisma.labBlankProfile.findUnique({ where: { id: input.id } })
    : input.serviceCode
      ? await prisma.labBlankProfile.findFirst({ where: { serviceCode: input.serviceCode } })
      : await prisma.labBlankProfile.findFirst({ where: { name } });
  const profile = existing
    ? await prisma.labBlankProfile.update({
        where: { id: existing.id },
        data: {
          name,
          kind: input.kind,
          serviceCode: input.serviceCode?.trim() || existing.serviceCode,
          active: true,
        },
      })
    : await prisma.labBlankProfile.create({
        data: {
          name,
          kind: input.kind,
          serviceCode: input.serviceCode || null,
          active: true,
        },
      });
  await prisma.labBlankRow.deleteMany({ where: { profileId: profile.id } });
  if (rows.length > 0) {
    await prisma.labBlankRow.createMany({
      data: rows.map((row, index) => ({
        organizationId: profile.organizationId,
        profileId: profile.id,
        sourceLabel: row.sourceLabel,
        analyteCode: row.analyteCode,
        sortOrder: index,
      })),
    });
  }
  return prisma.labBlankProfile.findUnique({
    where: { id: profile.id },
    include: { rows: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function deleteBlankProfile(id: string) {
  await prisma.labBlankProfile.delete({ where: { id } });
}
