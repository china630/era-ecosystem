import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { findProjectById } from "@/lib/projects.service";

export const ESTIMATE_MODES = ["FLAT_BOQ", "ESTIMATE_HIERARCHY"] as const;
export type EstimateMode = (typeof ESTIMATE_MODES)[number];

export const ESTIMATE_DOC_KINDS = [
  "LCR",
  "OCR",
  "SC",
  "SSR",
  "COST_SUMMARY",
] as const;
export type EstimateDocKind = (typeof ESTIMATE_DOC_KINDS)[number];

export const ESTIMATE_STATUSES = [
  "DRAFT",
  "INTERNAL_REVIEW",
  "EXTERNAL_REVIEW",
  "APPROVED",
  "SUPERSEDED",
] as const;
export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

const EDITABLE = new Set<EstimateStatus>([
  "DRAFT",
  "INTERNAL_REVIEW",
  "EXTERNAL_REVIEW",
]);

const TRANSITIONS: Record<EstimateStatus, EstimateStatus[]> = {
  DRAFT: ["INTERNAL_REVIEW"],
  INTERNAL_REVIEW: ["DRAFT", "EXTERNAL_REVIEW"],
  EXTERNAL_REVIEW: ["INTERNAL_REVIEW", "APPROVED"],
  APPROVED: ["SUPERSEDED"],
  SUPERSEDED: [],
};

function orgId() {
  return requestOrganizationId();
}

export async function setProjectEstimateMode(
  projectId: string,
  mode: EstimateMode,
) {
  if (!ESTIMATE_MODES.includes(mode)) {
    return { error: "Invalid estimateMode" as const, status: 400 as const };
  }
  const project = await findProjectById(projectId);
  if (!project) return { error: "Project not found" as const, status: 404 as const };

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { estimateMode: mode },
  });
  return { project: updated };
}

/** Link project (and optional open pack) to a Finance commercial contract for SOV seed. */
export async function setProjectFinanceContractId(
  projectId: string,
  financeContractId: string | null,
) {
  const project = await findProjectById(projectId);
  if (!project) return { error: "Project not found" as const, status: 404 as const };

  const trimmed = financeContractId?.trim() || null;
  const updated = await prisma.project.update({
    where: { id: projectId },
    data: { financeContractId: trimmed },
  });
  if (trimmed) {
    await prisma.estimatePackage.updateMany({
      where: {
        projectId,
        deletedAt: null,
        status: { in: [...EDITABLE] },
        OR: [{ financeContractId: null }, { financeContractId: "" }],
      },
      data: { financeContractId: trimmed },
    });
  }
  return { project: updated };
}

/**
 * Parse CSV text into estimate lines.
 * Header row optional. Columns: itemCode,description,qty,unitRate[,amountNet][,unit]
 */
export function parseEstimateLinesCsv(csvText: string): Array<{
  itemCode: string;
  description: string;
  qty: number;
  unitRate: number;
  amountNet?: number;
  unit?: string;
}> {
  const raw = csvText.replace(/^\uFEFF/, "").trim();
  if (!raw) return [];
  const rows = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (rows.length === 0) return [];

  const split = (line: string) => {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i]!;
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === "," && !inQuotes) {
        cells.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  };

  let start = 0;
  const first = split(rows[0]!).map((c) => c.toLowerCase());
  const hasHeader =
    first.includes("itemcode") ||
    first.includes("code") ||
    first.includes("description") ||
    first.includes("qty");
  let idx = {
    itemCode: 0,
    description: 1,
    qty: 2,
    unitRate: 3,
    amountNet: -1,
    unit: -1,
  };
  if (hasHeader) {
    start = 1;
    idx = {
      itemCode: Math.max(0, first.findIndex((c) => c === "itemcode" || c === "code")),
      description: Math.max(0, first.findIndex((c) => c === "description" || c === "desc")),
      qty: Math.max(0, first.findIndex((c) => c === "qty" || c === "quantity")),
      unitRate: Math.max(0, first.findIndex((c) => c === "unitrate" || c === "rate" || c === "price")),
      amountNet: first.findIndex((c) => c === "amountnet" || c === "amount"),
      unit: first.findIndex((c) => c === "unit"),
    };
  }

  const out: Array<{
    itemCode: string;
    description: string;
    qty: number;
    unitRate: number;
    amountNet?: number;
    unit?: string;
  }> = [];
  for (let r = start; r < rows.length; r += 1) {
    const cells = split(rows[r]!);
    const itemCode = cells[idx.itemCode] ?? "";
    const description = cells[idx.description] ?? "";
    const qty = Number(cells[idx.qty] ?? 0);
    const unitRate = Number(cells[idx.unitRate] ?? 0);
    const amountRaw = idx.amountNet >= 0 ? cells[idx.amountNet] : undefined;
    const unit = idx.unit >= 0 ? cells[idx.unit] : undefined;
    if (!itemCode && !description) continue;
    out.push({
      itemCode,
      description,
      qty,
      unitRate,
      ...(amountRaw != null && amountRaw !== ""
        ? { amountNet: Number(amountRaw) }
        : {}),
      ...(unit ? { unit } : {}),
    });
  }
  return out;
}

export async function importEstimateLinesFromCsv(
  documentId: string,
  csvText: string,
) {
  const lines = parseEstimateLinesCsv(csvText);
  if (lines.length === 0) {
    return { error: "CSV has no data rows" as const, status: 400 as const };
  }
  return replaceEstimateLines(documentId, lines);
}

export async function listEstimatePackages(projectId: string) {
  return prisma.estimatePackage.findMany({
    where: { projectId, deletedAt: null },
    include: {
      documents: {
        where: { deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { cipher: "asc" }],
        include: {
          lines: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
        },
      },
    },
    orderBy: { version: "desc" },
  });
}

export async function getEstimatePackage(packageId: string) {
  return prisma.estimatePackage.findFirst({
    where: { id: packageId, deletedAt: null },
    include: {
      documents: {
        where: { deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { cipher: "asc" }],
        include: {
          lines: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
}

export async function createEstimatePackage(
  projectId: string,
  body: { title?: string; notes?: string; financeContractId?: string } = {},
) {
  const project = await findProjectById(projectId);
  if (!project) return { error: "Project not found" as const, status: 404 as const };
  if (project.estimateMode !== "ESTIMATE_HIERARCHY") {
    return {
      error: "Project estimateMode must be ESTIMATE_HIERARCHY",
      status: 409 as const,
    };
  }

  const last = await prisma.estimatePackage.findFirst({
    where: { projectId, deletedAt: null },
    orderBy: { version: "desc" },
  });
  const version = (last?.version ?? 0) + 1;

  const pack = await prisma.estimatePackage.create({
    data: {
      organizationId: orgId(),
      projectId,
      version,
      title: body.title?.trim() || `Estimate pack v${version}`,
      notes: body.notes,
      financeContractId:
        body.financeContractId ?? project.financeContractId ?? null,
      status: "DRAFT",
    },
  });
  return { package: pack };
}

export async function addEstimateDocument(
  packageId: string,
  body: {
    kind: EstimateDocKind;
    cipher: string;
    title: string;
    parentDocumentId?: string | null;
    chapterNo?: number | null;
    sortOrder?: number;
  },
) {
  const pack = await prisma.estimatePackage.findFirst({
    where: { id: packageId, deletedAt: null },
  });
  if (!pack) return { error: "Package not found" as const, status: 404 as const };
  if (!EDITABLE.has(pack.status as EstimateStatus)) {
    return { error: "Package is not editable" as const, status: 409 as const };
  }
  if (!ESTIMATE_DOC_KINDS.includes(body.kind)) {
    return { error: "Invalid document kind" as const, status: 400 as const };
  }
  if (!body.cipher?.trim() || !body.title?.trim()) {
    return { error: "cipher and title are required" as const, status: 400 as const };
  }

  if (body.parentDocumentId) {
    const parent = await prisma.estimateDocument.findFirst({
      where: {
        id: body.parentDocumentId,
        packageId,
        deletedAt: null,
      },
    });
    if (!parent) {
      return { error: "Parent document not found" as const, status: 400 as const };
    }
  }

  const doc = await prisma.estimateDocument.create({
    data: {
      organizationId: orgId(),
      packageId,
      kind: body.kind,
      cipher: body.cipher.trim(),
      title: body.title.trim(),
      parentDocumentId: body.parentDocumentId ?? null,
      chapterNo: body.chapterNo ?? null,
      sortOrder: body.sortOrder ?? 0,
    },
  });
  return { document: doc };
}

export async function replaceEstimateLines(
  documentId: string,
  lines: Array<{
    itemCode: string;
    description: string;
    unit?: string;
    qty: number;
    unitRate?: number;
    amountNet?: number;
    sortOrder?: number;
  }>,
) {
  const doc = await prisma.estimateDocument.findFirst({
    where: { id: documentId, deletedAt: null },
    include: { package: true },
  });
  if (!doc) return { error: "Document not found" as const, status: 404 as const };
  if (!EDITABLE.has(doc.package.status as EstimateStatus)) {
    return { error: "Package is not editable" as const, status: 409 as const };
  }
  if (doc.kind !== "LCR" && doc.kind !== "SC") {
    return {
      error: "Lines are only allowed on LCR or SC documents",
      status: 400 as const,
    };
  }
  if (lines.length === 0) {
    return { error: "At least one line is required" as const, status: 400 as const };
  }

  const normalized = lines.map((line, index) => {
    const qty = Number(line.qty);
    const unitRate = Number(line.unitRate ?? 0);
    const amountNet =
      line.amountNet != null ? Number(line.amountNet) : qty * unitRate;
    return {
      organizationId: orgId(),
      documentId,
      itemCode: line.itemCode.trim(),
      description: line.description.trim(),
      unit: line.unit?.trim() || "ед.",
      qty,
      unitRate,
      amountNet,
      sortOrder: line.sortOrder ?? index,
    };
  });

  for (const line of normalized) {
    if (!line.itemCode || !line.description) {
      return { error: "itemCode and description required" as const, status: 400 as const };
    }
    if (!(line.qty > 0)) {
      return { error: "qty must be positive" as const, status: 400 as const };
    }
  }

  const amountNet = normalized.reduce((s, l) => s + Number(l.amountNet), 0);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.estimateLine.deleteMany({ where: { documentId } });
    await tx.estimateLine.createMany({ data: normalized });
    await tx.estimateDocument.update({
      where: { id: documentId },
      data: { amountNet },
    });
    await rollupPackageAmounts(tx, doc.packageId);
    return tx.estimateDocument.findFirst({
      where: { id: documentId },
      include: {
        lines: { where: { deletedAt: null }, orderBy: { sortOrder: "asc" } },
      },
    });
  });

  return { document: updated };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rollupPackageAmounts(tx: any, packageId: string) {
  const docs = await tx.estimateDocument.findMany({
    where: { packageId, deletedAt: null },
    include: { lines: { where: { deletedAt: null } } },
  });

  const byId = new Map(docs.map((d) => [d.id, d]));

  for (const doc of docs.filter((d) => d.kind === "LCR" || d.kind === "SC")) {
    const sum = doc.lines.reduce((s, l) => s + Number(l.amountNet), 0);
    if (Number(doc.amountNet) !== sum) {
      await tx.estimateDocument.update({
        where: { id: doc.id },
        data: { amountNet: sum },
      });
      doc.amountNet = sum as unknown as typeof doc.amountNet;
    }
  }

  for (const doc of docs.filter((d) => d.kind === "OCR")) {
    const children = docs.filter(
      (c) => c.parentDocumentId === doc.id && (c.kind === "LCR" || c.kind === "SC"),
    );
    const sum = children.reduce((s, c) => s + Number(c.amountNet), 0);
    await tx.estimateDocument.update({
      where: { id: doc.id },
      data: { amountNet: sum },
    });
    doc.amountNet = sum as unknown as typeof doc.amountNet;
  }

  for (const doc of docs.filter((d) => d.kind === "SSR")) {
    const children = docs.filter(
      (c) =>
        c.parentDocumentId === doc.id ||
        (c.kind === "OCR" && !c.parentDocumentId) ||
        (c.kind === "SC" && !c.parentDocumentId),
    );
    // Prefer explicit children; else sum all OCR + SC + orphan LCR in pack
    let sum = children.reduce((s, c) => s + Number(c.amountNet), 0);
    if (children.length === 0) {
      sum = docs
        .filter((c) => c.kind === "OCR" || c.kind === "SC" || c.kind === "LCR")
        .reduce((s, c) => s + Number(c.amountNet), 0);
    }
    await tx.estimateDocument.update({
      where: { id: doc.id },
      data: { amountNet: sum },
    });
  }

  for (const doc of docs.filter((d) => d.kind === "COST_SUMMARY")) {
    const ssrs = docs.filter((c) => c.kind === "SSR");
    const sum = ssrs.reduce((s, c) => s + Number(byId.get(c.id)?.amountNet ?? c.amountNet), 0);
    await tx.estimateDocument.update({
      where: { id: doc.id },
      data: { amountNet: sum },
    });
  }
}

export async function transitionEstimatePackage(
  packageId: string,
  nextStatus: EstimateStatus,
) {
  const pack = await prisma.estimatePackage.findFirst({
    where: { id: packageId, deletedAt: null },
  });
  if (!pack) return { error: "Package not found" as const, status: 404 as const };

  const current = pack.status as EstimateStatus;
  const allowed = TRANSITIONS[current] ?? [];
  if (!allowed.includes(nextStatus)) {
    return {
      error: `Cannot transition ${current} → ${nextStatus}`,
      status: 409 as const,
    };
  }

  if (nextStatus === "APPROVED") {
    return approveEstimatePackage(packageId);
  }

  const updated = await prisma.estimatePackage.update({
    where: { id: packageId },
    data: { status: nextStatus },
  });
  return { package: updated };
}

/**
 * Approve: freeze pack, supersede prior APPROVED, project LCR/SC lines → BoqLine.
 */
export async function approveEstimatePackage(packageId: string) {
  const pack = await getEstimatePackage(packageId);
  if (!pack) return { error: "Package not found" as const, status: 404 as const };
  if (pack.status === "APPROVED") {
    return { error: "Package already approved" as const, status: 409 as const };
  }
  if (pack.status !== "EXTERNAL_REVIEW") {
    return {
      error: "Package must be in EXTERNAL_REVIEW before approve",
      status: 409 as const,
    };
  }

  const project = await findProjectById(pack.projectId);
  const financeContractId =
    pack.financeContractId?.trim() ||
    project?.financeContractId?.trim() ||
    undefined;

  const leafDocs = pack.documents.filter((d) => d.kind === "LCR" || d.kind === "SC");
  const leafLines = leafDocs.flatMap((d) => d.lines);
  if (leafLines.length === 0) {
    return {
      error: "Cannot approve empty estimate (no LCR/SC lines)",
      status: 400 as const,
    };
  }

  const codes = new Set<string>();
  for (const line of leafLines) {
    if (codes.has(line.itemCode)) {
      return {
        error: `Duplicate itemCode across pack: ${line.itemCode}`,
        status: 400 as const,
      };
    }
    codes.add(line.itemCode);
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.estimatePackage.updateMany({
      where: {
        projectId: pack.projectId,
        status: "APPROVED",
        deletedAt: null,
        NOT: { id: packageId },
      },
      data: { status: "SUPERSEDED" },
    });

    const approved = await tx.estimatePackage.update({
      where: { id: packageId },
      data: { status: "APPROVED", approvedAt: new Date() },
    });

    for (const line of leafLines) {
      const boq = await tx.boqLine.upsert({
        where: {
          projectId_itemCode: {
            projectId: pack.projectId,
            itemCode: line.itemCode,
          },
        },
        update: {
          description: line.description,
          plannedQty: line.qty,
          plannedAmountNet: line.amountNet,
          estimateLineId: line.id,
          deletedAt: null,
        },
        create: {
          organizationId: pack.organizationId,
          projectId: pack.projectId,
          itemCode: line.itemCode,
          description: line.description,
          plannedQty: line.qty,
          plannedAmountNet: line.amountNet,
          estimateLineId: line.id,
        },
      });
      await tx.estimateLine.update({
        where: { id: line.id },
        data: { boqLineId: boq.id },
      });
    }

    return approved;
  });

  const lines = leafLines.map((line) => ({
    itemCode: line.itemCode,
    description: line.description,
    qty: Number(line.qty),
    amountNet: Number(line.amountNet),
  }));

  const sovSeedEligible = Boolean(financeContractId);
  return {
    package: result,
    sovSeedEligible,
    financeContractId: financeContractId ?? null,
    eventHint: {
      type: "SATELLITE_CONSTRUCTION_ESTIMATE_PACKAGE_APPROVED" as const,
      projectId: pack.projectId,
      packageId: pack.id,
      version: pack.version,
      financeContractId,
      lineCount: lines.length,
      amountNet: lines.reduce((s, l) => s + l.amountNet, 0),
      lines,
    },
  };
}

export async function estimatePlanFact(projectId: string) {
  const project = await findProjectById(projectId);
  if (!project) return { error: "Project not found" as const, status: 404 as const };

  const approved = await prisma.estimatePackage.findFirst({
    where: { projectId, status: "APPROVED", deletedAt: null },
    orderBy: { version: "desc" },
  });

  const boq = await prisma.boqLine.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { itemCode: "asc" },
  });

  const acts = await prisma.progressAct.findMany({
    where: { projectId, status: "APPROVED", deletedAt: null },
    include: { lines: { where: { deletedAt: null } } },
  });

  const actualByCode = new Map<string, { qty: number; amountNet: number }>();
  for (const act of acts) {
    for (const line of act.lines) {
      const cur = actualByCode.get(line.itemCode) ?? { qty: 0, amountNet: 0 };
      cur.qty += Number(line.qty);
      cur.amountNet += Number(line.amountNet);
      actualByCode.set(line.itemCode, cur);
    }
  }

  const lines = boq.map((b) => {
    const actual = actualByCode.get(b.itemCode) ?? { qty: 0, amountNet: 0 };
    return {
      itemCode: b.itemCode,
      description: b.description,
      plannedQty: Number(b.plannedQty),
      plannedAmountNet: Number(b.plannedAmountNet),
      actualQty: actual.qty,
      actualAmountNet: actual.amountNet,
      varianceAmountNet: actual.amountNet - Number(b.plannedAmountNet),
      estimateLineId: b.estimateLineId,
    };
  });

  return {
    projectId,
    estimateMode: project.estimateMode,
    approvedPackageId: approved?.id ?? null,
    approvedVersion: approved?.version ?? null,
    lines,
    totals: {
      plannedAmountNet: lines.reduce((s, l) => s + l.plannedAmountNet, 0),
      actualAmountNet: lines.reduce((s, l) => s + l.actualAmountNet, 0),
    },
  };
}
