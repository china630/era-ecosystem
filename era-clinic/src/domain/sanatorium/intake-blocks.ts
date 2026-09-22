/**
 * Default sanatorium intake AUTO_ON_OPEN blocks for PKG-* templates.
 * Used by import wizard (program-templates) and optional `db:seed:intake-blocks`.
 * ADR: docs/adr/clinic-catalog-template-overlay.md
 */

export const INTAKE_BLOCKS = [
  {
    procedureCode: "VISIT-SANATORIUM-INTAKE",
    procedureName: "Sanatorium intake / doctor exam",
    kind: "EXAM",
    assignMode: "AUTO_ON_OPEN",
    fulfillment: "VISIT",
    quotaBasis: "PER_STAY",
    requiresDoctor: true,
    sortOrder: 0,
  },
  {
    procedureCode: "GYN-OR-URO",
    procedureName: "Gynecologist / urologist exam",
    kind: "EXAM",
    assignMode: "AUTO_ON_OPEN",
    fulfillment: "VISIT",
    quotaBasis: "PER_STAY",
    requiresDoctor: true,
    sortOrder: 1,
  },
  {
    procedureCode: "CARDIO-ECG",
    procedureName: "ECG 12-lead",
    kind: "LAB",
    assignMode: "AUTO_ON_OPEN",
    fulfillment: "LAB_ORDER",
    quotaBasis: "PER_STAY",
    requiresDoctor: false,
    sortOrder: 2,
  },
  {
    procedureCode: "USG-ABD",
    procedureName: "Abdominal ultrasound",
    kind: "LAB",
    assignMode: "AUTO_ON_OPEN",
    fulfillment: "LAB_ORDER",
    quotaBasis: "PER_STAY",
    requiresDoctor: false,
    sortOrder: 3,
  },
] as const;

export type IntakeBlockEnsureReport = {
  created: string[];
  updated: string[];
  knots: number;
};

type IntakeTx = {
  programTemplateProcedure: {
    findFirst: (args: unknown) => Promise<{
      id: string;
      assignMode: string;
      fulfillment: string;
      quotaBasis: string;
      requiresDoctor: boolean;
      kind: string | null;
      procedureName: string;
    } | null>;
    create: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
  };
  programTemplateQuotaKnot: {
    findFirst: (args: unknown) => Promise<{ id: string } | null>;
    create: (args: unknown) => Promise<unknown>;
  };
};

/**
 * Ensure intake AUTO blocks + PER_STAY knots on a current program template.
 * Idempotent; does not bump template version (caller may bump first).
 */
export async function ensureIntakeBlocksOnTemplate(
  tx: IntakeTx,
  templateId: string,
  nightCols: number[],
): Promise<IntakeBlockEnsureReport> {
  const report: IntakeBlockEnsureReport = { created: [], updated: [], knots: 0 };
  const cols = nightCols.length > 0 ? nightCols : [7, 10, 14, 21];

  for (const block of INTAKE_BLOCKS) {
    const existing = await tx.programTemplateProcedure.findFirst({
      where: { templateId, procedureCode: block.procedureCode },
    });
    if (!existing) {
      await tx.programTemplateProcedure.create({
        data: {
          templateId,
          procedureCode: block.procedureCode,
          procedureName: block.procedureName,
          quotaTotal: 1,
          kind: block.kind,
          sortOrder: block.sortOrder,
          assignMode: block.assignMode,
          fulfillment: block.fulfillment,
          quotaBasis: block.quotaBasis,
          requiresDoctor: block.requiresDoctor,
        },
      });
      report.created.push(block.procedureCode);
    } else {
      const needsUpdate =
        existing.assignMode !== block.assignMode ||
        existing.fulfillment !== block.fulfillment ||
        existing.quotaBasis !== block.quotaBasis ||
        existing.requiresDoctor !== block.requiresDoctor ||
        existing.kind !== block.kind;
      if (needsUpdate) {
        await tx.programTemplateProcedure.update({
          where: { id: existing.id },
          data: {
            assignMode: block.assignMode,
            fulfillment: block.fulfillment,
            quotaBasis: block.quotaBasis,
            requiresDoctor: block.requiresDoctor,
            kind: block.kind,
            procedureName: existing.procedureName || block.procedureName,
          },
        });
        report.updated.push(block.procedureCode);
      }
    }

    for (const nights of cols) {
      const knot = await tx.programTemplateQuotaKnot.findFirst({
        where: {
          templateId,
          nights,
          procedureCode: block.procedureCode,
        },
      });
      if (!knot) {
        await tx.programTemplateQuotaKnot.create({
          data: {
            templateId,
            nights,
            procedureCode: block.procedureCode,
            qty: 1,
          },
        });
        report.knots += 1;
      }
    }
  }
  return report;
}
