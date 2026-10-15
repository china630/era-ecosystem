import { prisma } from "@/lib/prisma";
import { extractBlankTable, isFilledBlankValue, type BlankTableRow } from "@/domain/lab/blank-docx";

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

export async function saveBlankProfile(input: {
  name: string;
  kind: "TABLE" | "NARRATIVE";
  serviceCode?: string | null;
  rows: Array<{ sourceLabel: string; analyteCode: string }>;
}) {
  const profile = await prisma.labBlankProfile.create({
    data: {
      name: input.name,
      kind: input.kind,
      serviceCode: input.serviceCode || null,
      active: true,
    },
  });
  if (input.rows.length > 0) {
    await prisma.labBlankRow.createMany({
      data: input.rows.map((row, index) => ({
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
