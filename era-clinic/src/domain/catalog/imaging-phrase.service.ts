import { prisma } from "@/lib/prisma";
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
