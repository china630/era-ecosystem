import { requestOrganizationId } from "@/lib/request-organization";
import type { ImportTx } from "@/lib/import/types";

export async function findImportRecordId(
  tx: ImportTx,
  entity: string,
  externalRef: string,
): Promise<string | null> {
  const row = await tx.cutoverImportKey.findFirst({
    where: { entity, externalRef },
    select: { recordId: true },
  });
  return row?.recordId ?? null;
}

export async function bindImportRecord(
  tx: ImportTx,
  entity: string,
  externalRef: string,
  recordId: string,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) return;
  const existing = await tx.cutoverImportKey.findFirst({
    where: { entity, externalRef },
  });
  if (existing) {
    await tx.cutoverImportKey.update({
      where: { id: existing.id },
      data: { recordId },
    });
    return;
  }
  await tx.cutoverImportKey.create({
    data: { entity, externalRef, recordId, organizationId: requestOrganizationId() },
  });
}
