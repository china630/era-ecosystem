/**
 * Batch remaining print-forms wiring
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

function write(rel, content) {
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.replace(/\r\n/g, "\n"), "utf8");
  console.log("wrote", rel);
}

function patch(rel, fn) {
  const full = path.join(ROOT, rel);
  let s = fs.readFileSync(full, "utf8");
  const next = fn(s);
  if (next === s) console.warn("NO CHANGE", rel);
  else {
    fs.writeFileSync(full, next, "utf8");
    console.log("patched", rel);
  }
}

// --- catalog shared types ---
patch("src/domain/catalog/diagnostic-catalog-shared.ts", (s) =>
  s.replace(
    `export type CatalogAnalyteDef = {
  code: string;
  unit?: string;
  label: L10n;
  refMin?: string;
  refMax?: string;
};`,
    `export type CatalogAnalyteValueOption = {
  code: string;
  label: L10n;
};

export type CatalogAnalyteDef = {
  code: string;
  unit?: string;
  label: L10n;
  refMin?: string;
  refMax?: string;
  section?: string;
  valueType?: "NUMERIC" | "QUALITATIVE";
  valueOptions?: CatalogAnalyteValueOption[];
};`,
  ),
);

// --- catalog loader include options ---
patch("src/domain/catalog/diagnostic-catalog.ts", (s) => {
  let out = s.replace(
    "include: { analytes: { orderBy: { sortOrder: \"asc\" } } },",
    "include: { analytes: { orderBy: { sortOrder: \"asc\" }, include: { valueOptions: { orderBy: { sortOrder: \"asc\" } } } } },",
  );
  out = out.replace(
    `item.analytes = svc.analytes.map((a): CatalogAnalyteDef => ({
          code: a.code,
          unit: a.unit ?? undefined,
          label: { en: a.labelEn, ru: a.labelRu, az: a.labelAz },
          refMin: a.refMin ?? undefined,
          refMax: a.refMax ?? undefined,
        }));`,
    `item.analytes = svc.analytes.map((a): CatalogAnalyteDef => ({
          code: a.code,
          unit: a.unit ?? undefined,
          label: { en: a.labelEn, ru: a.labelRu, az: a.labelAz },
          refMin: a.refMin ?? undefined,
          refMax: a.refMax ?? undefined,
          section: a.section ?? undefined,
          valueType: a.valueType === "QUALITATIVE" ? "QUALITATIVE" : "NUMERIC",
          valueOptions: (a.valueOptions ?? []).map((o) => ({
            code: o.code,
            label: { en: o.labelEn, ru: o.labelRu, az: o.labelAz },
          })),
        }));`,
  );
  return out;
});

write(
  "src/domain/catalog/imaging-phrase.service.ts",
  `import { prisma } from "@/lib/prisma";
import { invalidateDiagnosticCatalogCache } from "@/domain/catalog/diagnostic-catalog";

export type ImagingPhraseInput = {
  organKey: string;
  code: string;
  textEn: string;
  textRu: string;
  textAz: string;
  measurementKeys?: string[];
  sortOrder?: number;
  active?: boolean;
};

export async function listImagingPhrases(opts?: { organKey?: string; includeInactive?: boolean }) {
  return prisma.imagingPhrase.findMany({
    where: {
      ...(opts?.organKey ? { organKey: opts.organKey } : {}),
      ...(opts?.includeInactive ? {} : { active: true }),
    },
    orderBy: [{ organKey: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
  });
}

export async function createImagingPhrase(data: ImagingPhraseInput) {
  const row = await prisma.imagingPhrase.create({
    data: {
      organKey: data.organKey,
      code: data.code,
      textEn: data.textEn,
      textRu: data.textRu,
      textAz: data.textAz,
      measurementKeysJson: data.measurementKeys ? JSON.stringify(data.measurementKeys) : null,
      sortOrder: data.sortOrder ?? 0,
      active: data.active ?? true,
    },
  });
  invalidateDiagnosticCatalogCache();
  return row;
}

export async function updateImagingPhrase(id: string, data: Partial<ImagingPhraseInput>) {
  const row = await prisma.imagingPhrase.update({
    where: { id },
    data: {
      ...(data.organKey != null ? { organKey: data.organKey } : {}),
      ...(data.code != null ? { code: data.code } : {}),
      ...(data.textEn != null ? { textEn: data.textEn } : {}),
      ...(data.textRu != null ? { textRu: data.textRu } : {}),
      ...(data.textAz != null ? { textAz: data.textAz } : {}),
      ...(data.measurementKeys !== undefined
        ? {
            measurementKeysJson: data.measurementKeys
              ? JSON.stringify(data.measurementKeys)
              : null,
          }
        : {}),
      ...(data.sortOrder != null ? { sortOrder: data.sortOrder } : {}),
      ...(data.active != null ? { active: data.active } : {}),
    },
  });
  invalidateDiagnosticCatalogCache();
  return row;
}

export async function deleteImagingPhrase(id: string) {
  await prisma.imagingPhrase.delete({ where: { id } });
  invalidateDiagnosticCatalogCache();
}
`,
);

write(
  "app/api/admin/diagnostic-catalog/imaging-phrases/route.ts",
  `import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import {
  createImagingPhrase,
  listImagingPhrases,
} from "@/domain/catalog/imaging-phrase.service";

const createSchema = z.object({
  organKey: z.string().min(1),
  code: z.string().min(1),
  textEn: z.string().min(1),
  textRu: z.string().min(1),
  textAz: z.string().min(1),
  measurementKeys: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const url = new URL(req.url);
    const organKey = url.searchParams.get("organKey") ?? undefined;
    const includeInactive = url.searchParams.get("includeInactive") === "true";
    return jsonOk(await listImagingPhrases({ organKey, includeInactive }));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const body = createSchema.parse(await req.json());
    return jsonOk(await createImagingPhrase(body), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
`,
);

write(
  "app/api/admin/diagnostic-catalog/imaging-phrases/[id]/route.ts",
  `import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminWrite } from "@/lib/auth/clinic-admin-guard";
import {
  deleteImagingPhrase,
  updateImagingPhrase,
} from "@/domain/catalog/imaging-phrase.service";

const updateSchema = z.object({
  organKey: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  textEn: z.string().min(1).optional(),
  textRu: z.string().min(1).optional(),
  textAz: z.string().min(1).optional(),
  measurementKeys: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    const body = updateSchema.parse(await req.json());
    return jsonOk(await updateImagingPhrase(id, body));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await assertClinicAdminWrite();
    if (guard.error) return guard.error;
    const { id } = await ctx.params;
    await deleteImagingPhrase(id);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
`,
);

write(
  "app/api/imaging-phrases/route.ts",
  `import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { listImagingPhrases } from "@/domain/catalog/imaging-phrase.service";
import { requireClinicSession } from "@/lib/auth/clinic-session";

export async function GET(req: Request) {
  try {
    await requireClinicSession();
    const url = new URL(req.url);
    const organKey = url.searchParams.get("organKey") ?? undefined;
    return jsonOk(await listImagingPhrases({ organKey }));
  } catch (err) {
    return handleRouteError(err);
  }
}
`,
);

// --- admin analyte service fields ---
patch("src/domain/catalog/diagnostic-catalog-admin.service.ts", (s) => {
  let out = s.replace(
    `export async function listAnalytes(serviceId: string) {
  return prisma.diagnosticAnalyte.findMany({
    where: { serviceId },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
}`,
    `export async function listAnalytes(serviceId: string) {
  return prisma.diagnosticAnalyte.findMany({
    where: { serviceId },
    include: { valueOptions: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
}`,
  );
  out = out.replace(
    `export type AnalyteInput = {
  code: string;
  unit?: string | null;
  labelEn: string;
  labelRu: string;
  labelAz: string;
  refMin?: string | null;
  refMax?: string | null;
  sortOrder?: number;
};`,
    `export type AnalyteValueOptionInput = {
  code: string;
  labelEn: string;
  labelRu: string;
  labelAz: string;
  sortOrder?: number;
};

export type AnalyteInput = {
  code: string;
  unit?: string | null;
  labelEn: string;
  labelRu: string;
  labelAz: string;
  refMin?: string | null;
  refMax?: string | null;
  section?: string | null;
  valueType?: "NUMERIC" | "QUALITATIVE";
  sortOrder?: number;
  valueOptions?: AnalyteValueOptionInput[];
};`,
  );
  out = out.replace(
    `export async function createAnalyte(
  ctx: AuditCtx,
  serviceId: string,
  data: AnalyteInput,
) {
  const row = await prisma.diagnosticAnalyte.create({
    data: { ...data, serviceId },
  });
  await audit(ctx, "diagnosticAnalyte", row.id, "CREATE", { serviceId, ...data });
  invalidateDiagnosticCatalogCache();
  return row;
}`,
    `export async function createAnalyte(
  ctx: AuditCtx,
  serviceId: string,
  data: AnalyteInput,
) {
  const { valueOptions, ...rest } = data;
  const row = await prisma.diagnosticAnalyte.create({
    data: {
      ...rest,
      serviceId,
      ...(valueOptions?.length
        ? {
            valueOptions: {
              create: valueOptions.map((o, i) => ({
                code: o.code,
                labelEn: o.labelEn,
                labelRu: o.labelRu,
                labelAz: o.labelAz,
                sortOrder: o.sortOrder ?? i,
              })),
            },
          }
        : {}),
    },
    include: { valueOptions: true },
  });
  await audit(ctx, "diagnosticAnalyte", row.id, "CREATE", { serviceId, ...data });
  invalidateDiagnosticCatalogCache();
  return row;
}`,
  );
  out = out.replace(
    `export async function updateAnalyte(
  ctx: AuditCtx,
  analyteId: string,
  data: Partial<AnalyteInput>,
) {
  const row = await prisma.diagnosticAnalyte.update({
    where: { id: analyteId },
    data,
  });
  await audit(ctx, "diagnosticAnalyte", analyteId, "UPDATE", data);
  invalidateDiagnosticCatalogCache();
  return row;
}`,
    `export async function updateAnalyte(
  ctx: AuditCtx,
  analyteId: string,
  data: Partial<AnalyteInput>,
) {
  const { valueOptions, ...rest } = data;
  const row = await prisma.$transaction(async (tx) => {
    if (valueOptions) {
      await tx.analyteValueOption.deleteMany({ where: { analyteId } });
      if (valueOptions.length) {
        await tx.analyteValueOption.createMany({
          data: valueOptions.map((o, i) => ({
            analyteId,
            code: o.code,
            labelEn: o.labelEn,
            labelRu: o.labelRu,
            labelAz: o.labelAz,
            sortOrder: o.sortOrder ?? i,
          })),
        });
      }
    }
    return tx.diagnosticAnalyte.update({
      where: { id: analyteId },
      data: rest,
      include: { valueOptions: { orderBy: { sortOrder: "asc" } } },
    });
  });
  await audit(ctx, "diagnosticAnalyte", analyteId, "UPDATE", data);
  invalidateDiagnosticCatalogCache();
  return row;
}`,
  );
  return out;
});

patch("app/api/admin/diagnostic-catalog/services/[id]/analytes/route.ts", (s) =>
  s.replace(
    `  refMax: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});`,
    `  refMax: z.string().nullable().optional(),
  section: z.string().nullable().optional(),
  valueType: z.enum(["NUMERIC", "QUALITATIVE"]).optional(),
  sortOrder: z.number().int().optional(),
  valueOptions: z
    .array(
      z.object({
        code: z.string().min(1),
        labelEn: z.string().min(1),
        labelRu: z.string().min(1),
        labelAz: z.string().min(1),
        sortOrder: z.number().int().optional(),
      }),
    )
    .optional(),
});`,
  ),
);

patch("app/api/admin/diagnostic-catalog/services/[id]/analytes/[analyteId]/route.ts", (s) =>
  s.replace(
    `  refMax: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});`,
    `  refMax: z.string().nullable().optional(),
  section: z.string().nullable().optional(),
  valueType: z.enum(["NUMERIC", "QUALITATIVE"]).optional(),
  sortOrder: z.number().int().optional(),
  valueOptions: z
    .array(
      z.object({
        code: z.string().min(1),
        labelEn: z.string().min(1),
        labelRu: z.string().min(1),
        labelAz: z.string().min(1),
        sortOrder: z.number().int().optional(),
      }),
    )
    .optional(),
});`,
  ),
);

console.log("batch core done");
