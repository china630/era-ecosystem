import {
  IMPORT_ROW_CAP,
  mapHeaders,
  mapRowToImport,
  parseCsvText,
  type ImportReport,
} from "@/lib/lead-import";
import { normalizeAzPhone, syncContactRef } from "@/lib/lead-party";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export function parseWorkbook(buffer: ArrayBuffer): string[][] {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });
}

export { parseCsvText };

export async function findImportBatchById(batchId: string) {
  return prisma.importBatch.findUnique({
    where: { id: batchId },
    include: {
      leads: {
        select: {
          id: true,
          title: true,
          taxId: true,
          contactPhone: true,
          prospectType: true,
          stage: true,
        },
        take: 50,
      },
    },
  });
}

export async function runLeadImport(
  rows: string[][],
  fileName: string,
  createdBy: string | null,
  mode: "upsert" | "create-only",
): Promise<{ batchId: string; report: ImportReport }> {
  if (rows.length < 2) {
    throw new Error("File must have header + at least one data row");
  }
  const headers = rows[0];
  const colIndex = mapHeaders(headers);
  const dataRows = rows.slice(1).filter((r) => r.some((c) => c?.trim()));
  if (dataRows.length > IMPORT_ROW_CAP) {
    throw new Error(`Import capped at ${IMPORT_ROW_CAP} rows`);
  }

  const batch = await prisma.importBatch.create({
    data: {
      fileName,
      createdBy: createdBy ?? undefined,
      status: "PENDING",
    },
  });

  const report: ImportReport = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (let i = 0; i < dataRows.length; i++) {
    const rowNum = i + 2;
    const mapped = mapRowToImport(dataRows[i], colIndex, rowNum);
    if ("error" in mapped) {
      report.errors.push({ row: rowNum, message: mapped.error });
      continue;
    }

    const contactRef = syncContactRef(
      undefined,
      mapped.contactPhone,
      "phone",
    );
    if (!contactRef && mapped.partyKind === "INDIVIDUAL") {
      report.errors.push({ row: rowNum, message: "Missing phone" });
      continue;
    }

    const dedupWhere =
      mapped.taxId
        ? { taxId: mapped.taxId }
        : mapped.contactPhone
          ? { contactPhone: normalizeAzPhone(mapped.contactPhone) }
          : null;

    try {
      if (dedupWhere) {
        const existing = await prisma.lead.findFirst({ where: dedupWhere });
        if (existing) {
          if (mode === "create-only") {
            report.skipped++;
            continue;
          }
          await prisma.lead.update({
            where: { id: existing.id },
            data: {
              title: mapped.title,
              companyName: mapped.companyName,
              contactPhone: mapped.contactPhone
                ? normalizeAzPhone(mapped.contactPhone)
                : undefined,
              contactEmail: mapped.contactEmail,
              activitySector: mapped.activitySector,
              addressLabel: mapped.addressLabel,
              sourceRef: mapped.sourceRef,
              importBatchId: batch.id,
              partyKind: mapped.partyKind,
              taxId: mapped.taxId,
            },
          });
          report.updated++;
          continue;
        }
      }

      await prisma.lead.create({
        data: {
          title: mapped.title,
          contactRef: contactRef || mapped.title,
          channel: mapped.contactPhone ? "phone" : "other",
          partyKind: mapped.partyKind,
          taxId: mapped.taxId,
          companyName: mapped.companyName,
          contactPhone: mapped.contactPhone
            ? normalizeAzPhone(mapped.contactPhone)
            : undefined,
          contactEmail: mapped.contactEmail,
          activitySector: mapped.activitySector,
          addressLabel: mapped.addressLabel,
          sourceRef: mapped.sourceRef,
          importBatchId: batch.id,
          stageHistory: { create: { toStage: "NEW" } },
        },
      });
      report.created++;
    } catch (e) {
      report.errors.push({
        row: rowNum,
        message: e instanceof Error ? e.message : "Import failed",
      });
    }
  }

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      status: report.errors.length && report.created + report.updated === 0
        ? "FAILED"
        : "COMPLETED",
      reportJson: JSON.stringify(report),
      completedAt: new Date(),
    },
  });

  return { batchId: batch.id, report };
}
