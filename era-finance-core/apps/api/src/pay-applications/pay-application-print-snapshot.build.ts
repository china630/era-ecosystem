import type { PrismaService } from "../prisma/prisma.service";

export async function buildPayApplicationPrintSnapshot(
  prisma: PrismaService,
  input: { organizationId: string; payApplicationId: string },
) {
  const row = await prisma.payApplication.findFirst({
    where: { id: input.payApplicationId, organizationId: input.organizationId },
    include: {
      contract: {
        include: {
          counterparty: { select: { id: true, nameCipher: true, taxIdCipher: true } },
        },
      },
      lines: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!row) throw new Error("Pay application not found");

  return {
    blankId: "FINANCE_KS_PAYAPP",
    number: row.number,
    contractNumber: row.contract.number,
    status: row.status,
    periodFrom: row.periodFrom?.toISOString().slice(0, 10) ?? null,
    periodTo: row.periodTo?.toISOString().slice(0, 10) ?? null,
    retentionPct: String(row.retentionPct),
    amountGross: String(row.amountGross),
    amountRetention: String(row.amountRetention),
    amountNet: String(row.amountNet),
    counterpartyId: row.contract.counterpartyId,
    lines: row.lines.map((l) => ({
      description: l.description ?? "",
      quantity: l.quantity != null ? String(l.quantity) : "",
      amount: String(l.amount),
      sourceActId: l.sourceActId ?? "",
    })),
  };
}

export function renderKs2Html(snapshot: Record<string, unknown>): string {
  const lines = (snapshot.lines as Array<Record<string, string>>) ?? [];
  const rows = lines
    .map(
      (l, i) =>
        `<tr><td>${i + 1}</td><td>${escapeHtml(l.description)}</td><td>${escapeHtml(l.quantity)}</td><td>${escapeHtml(l.amount)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"/><title>KS-2 ${escapeHtml(String(snapshot.number ?? ""))}</title></head>
<body>
<h1>КС-2 / Act of completed works</h1>
<p>No: ${escapeHtml(String(snapshot.number ?? ""))} · Contract: ${escapeHtml(String(snapshot.contractNumber ?? ""))}</p>
<p>Period: ${escapeHtml(String(snapshot.periodFrom ?? ""))} — ${escapeHtml(String(snapshot.periodTo ?? ""))}</p>
<table border="1" cellpadding="4" cellspacing="0">
<thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Amount</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<p>Gross: ${escapeHtml(String(snapshot.amountGross))} · Retention: ${escapeHtml(String(snapshot.amountRetention))} · Net: ${escapeHtml(String(snapshot.amountNet))}</p>
</body></html>`;
}

export function renderKs3Html(snapshot: Record<string, unknown>): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>KS-3 ${escapeHtml(String(snapshot.number ?? ""))}</title></head>
<body>
<h1>КС-3 / Cost certificate</h1>
<p>No: ${escapeHtml(String(snapshot.number ?? ""))} · Contract: ${escapeHtml(String(snapshot.contractNumber ?? ""))}</p>
<p>Gross ${escapeHtml(String(snapshot.amountGross))} · Retention ${escapeHtml(String(snapshot.amountRetention))} (${escapeHtml(String(snapshot.retentionPct))}%) · Net ${escapeHtml(String(snapshot.amountNet))}</p>
<p>Status: ${escapeHtml(String(snapshot.status ?? ""))}</p>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
