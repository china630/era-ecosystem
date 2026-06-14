/**
 * e-qaimə submission driver (Finance boundary). Hotel reads status only (H-BL-24).
 */

export type EqaimeSubmitInput = {
  invoiceNumber: string;
  amountAzn: number;
  voen: string;
  counterpartyName: string;
};

export type EqaimeSubmitResult = {
  mode: 'mock' | 'live';
  eqaimeId: string;
  status: 'SUBMITTED' | 'REJECTED';
  message?: string;
};

export async function submitEqaimeDocument(input: EqaimeSubmitInput): Promise<EqaimeSubmitResult> {
  const live =
    process.env.EQAIME_LIVE === 'true' &&
    Boolean(process.env.EQAIME_SIGNER_CERT_PATH?.trim());

  if (!live) {
    return {
      mode: 'mock',
      eqaimeId: `mock-eq-${Date.now()}`,
      status: 'SUBMITTED',
      message: 'Mock e-qaimə — configure EQAIME_LIVE + signer cert for production',
    };
  }

  // Production: Asan İmza / e-Signer integration placeholder
  return {
    mode: 'live',
    eqaimeId: `eq-${input.invoiceNumber}`,
    status: 'SUBMITTED',
  };
}

export async function syncEqaimeStatusToFiscalDocument(fiscalDocumentId: string) {
  const { prisma } = await import('@/lib/prisma');
  const doc = await prisma.fiscalDocument.findUnique({ where: { id: fiscalDocumentId } });
  if (!doc?.eqaimeId) return doc;

  return prisma.fiscalDocument.update({
    where: { id: fiscalDocumentId },
    data: { eqaimeStatus: doc.eqaimeStatus ?? 'SUBMITTED' },
  });
}
