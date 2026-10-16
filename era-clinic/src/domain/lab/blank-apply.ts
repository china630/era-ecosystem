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
    if (profile.serviceCode && item.serviceCode !== profile.serviceCode) continue;
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
    return {
      mode: "fields",
      fields: parseUsmSections(extractDocxParagraphs(input.docx), {
        kind,
        sex: order.patientRef.sex,
      }),
      omit: usmFieldsOmitted(order.patientRef.sex),
    };
  }
  const codes = order.items.map((item) => item.serviceCode).filter(Boolean);
  const profile = input.profileId
    ? await prisma.labBlankProfile.findUnique({ where: { id: input.profileId } })
    : await prisma.labBlankProfile.findFirst({
        where: { active: true, serviceCode: serviceCode ? serviceCode : { in: codes } },
        orderBy: { name: "asc" },
      });
  if (!profile) return { mode: "missing" };
  const rows = await previewBlankForOrder({
    orderId: input.orderId,
    profileId: profile.id,
    docx: input.docx,
  });
  return { mode: "rows", rows };
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
