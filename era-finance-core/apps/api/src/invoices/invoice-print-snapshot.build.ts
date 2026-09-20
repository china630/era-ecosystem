/**
 * Build a flat PrintSnapshot for FINANCE_INVOICE_COMMERCIAL (W3).
 * Live snapshot — not persisted.
 */
import {
  EXTRA_ENTITY_FINANCE_INVOICE,
  FINANCE_INVOICE_COMMERCIAL_BASE_WHITELIST,
  FINANCE_INVOICE_COMMERCIAL_LINE_WHITELIST,
  PRINT_BLANK_FINANCE_INVOICE_COMMERCIAL,
  PRINT_LINES_MAX,
  interpolatePrintTemplate,
  normalizePrintLang,
  type PrintLang,
  type PrintSnapshot,
  type PrintSnapshotIssue,
  type PrintSnapshotLine,
  type PrintSnapshotScalar,
} from "@era/satellite-kit";
import { Prisma } from "@erafinance/database";
import { decodeOrganizationTaxId, decryptText } from "../security/pii-crypto.util";
import type { PrismaService } from "../prisma/prisma.service";

const Decimal = Prisma.Decimal;

const LABELS: Record<PrintLang, Record<string, string>> = {
  az: {
    title: "Kommersiya hesab-fakturası",
    buyer: "Alıcı",
    due: "Ödəniş tarixi",
    total: "Cəmi",
    paid: "Ödənilib",
    remaining: "Qalıq",
    lines: "Sətirlər",
    description: "Təsvir",
    qty: "Miqdar",
    unitPrice: "Qiymət",
    vat: "ƏDV %",
    lineTotal: "Məbləğ",
    extras: "Əlavə sahələr",
    voen: "VÖEN",
  },
  ru: {
    title: "Коммерческий счёт",
    buyer: "Покупатель",
    due: "Срок оплаты",
    total: "Итого",
    paid: "Оплачено",
    remaining: "Остаток",
    lines: "Позиции",
    description: "Описание",
    qty: "Кол-во",
    unitPrice: "Цена",
    vat: "НДС %",
    lineTotal: "Сумма",
    extras: "Доп. поля",
    voen: "ВНН",
  },
  en: {
    title: "Commercial invoice",
    buyer: "Buyer",
    due: "Due date",
    total: "Total",
    paid: "Paid",
    remaining: "Remaining",
    lines: "Lines",
    description: "Description",
    qty: "Qty",
    unitPrice: "Unit price",
    vat: "VAT %",
    lineTotal: "Line total",
    extras: "Extra fields",
    voen: "Tax ID",
  },
};

function money4(v: Prisma.Decimal | number | string | null | undefined): string {
  if (v == null) return "0.0000";
  return new Decimal(v).toFixed(4);
}

function dateYmd(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
}

function formatBankLine(
  accounts: Array<{
    bankName: string | null;
    accountNumber: string | null;
    currency: string | null;
    iban: string | null;
    swift: string | null;
  }>,
): string {
  if (!accounts.length) return "";
  const a = accounts[0];
  const parts = [
    a.bankName,
    a.accountNumber,
    a.currency,
    a.iban ? `IBAN ${a.iban}` : null,
    a.swift ? `SWIFT ${a.swift}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function scalarExtra(v: unknown): PrintSnapshotScalar {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean" || typeof v === "number") return v;
  if (typeof v === "string") return v;
  return String(v);
}

function escapeHtmlAttr(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** http(s) or same-origin `/files/...` (org logo upload). No protocol-relative. */
export function safePrintLogoSrc(raw: PrintSnapshotScalar): string | null {
  if (typeof raw !== "string") return null;
  const u = raw.trim();
  if (!u || u.length > 2048) return null;
  if (u.startsWith("/") && !u.startsWith("//") && !u.includes("\\")) {
    if (/[\s<>"'`]/.test(u)) return null;
    return u;
  }
  if (!/^https?:\/\//i.test(u)) return null;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export type InvoicePrintSnapshotResult = PrintSnapshot & {
  whitelist: string[];
  lineWhitelist: readonly string[];
};

export async function buildInvoicePrintSnapshot(
  prisma: PrismaService,
  organizationId: string,
  invoiceId: string,
  langRaw?: string | null,
): Promise<InvoicePrintSnapshotResult | null> {
  const lang = normalizePrintLang(langRaw);
  const inv = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId, deletedAt: null },
    include: {
      counterparty: true,
      items: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: { product: true },
      },
      organization: {
        include: {
          bankAccountsOrg: {
            where: { deletedAt: null, isArchived: false },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
            take: 1,
          },
        },
      },
    },
  });
  if (!inv) return null;

  const defs = await prisma.extraFieldDefinition.findMany({
    where: {
      organizationId,
      entityType: EXTRA_ENTITY_FINANCE_INVOICE,
      active: true,
    },
    select: { key: true },
  });
  const extraKeys = defs.map((d) => d.key);
  const rawExtras =
    inv.extraAttributes &&
    typeof inv.extraAttributes === "object" &&
    !Array.isArray(inv.extraAttributes)
      ? (inv.extraAttributes as Record<string, unknown>)
      : {};

  const paidTotal = inv.paidAmount ?? new Decimal(0);
  const remaining = inv.totalAmount.sub(paidTotal);
  const buyerName = inv.counterparty.nameCipher
    ? decryptText(inv.counterparty.nameCipher) ?? ""
    : "";
  const buyerTax = inv.counterparty.taxIdCipher
    ? decryptText(inv.counterparty.taxIdCipher) ?? ""
    : "";

  const L = LABELS[lang];
  const values: Record<string, PrintSnapshotScalar> = {
    "org.name": inv.organization.name ?? "",
    "org.taxId": decodeOrganizationTaxId(inv.organization) || "",
    "org.legalAddress": inv.organization.legalAddress ?? "",
    "org.logoUrl": inv.organization.logoUrl ?? "",
    "org.bankLine": formatBankLine(inv.organization.bankAccountsOrg),
    "buyer.name": buyerName,
    "buyer.taxId": buyerTax,
    "invoice.number": inv.number,
    "invoice.status": inv.status,
    "invoice.dueDate": dateYmd(inv.dueDate),
    "invoice.currency": inv.currency,
    "invoice.total": money4(inv.totalAmount),
    "invoice.paid": money4(paidTotal),
    "invoice.remaining": money4(remaining),
    "invoice.tradeContext": inv.tradeContext ?? "",
    "label.title": L.title,
    "label.buyer": L.buyer,
    "label.due": L.due,
    "label.total": L.total,
    "label.paid": L.paid,
    "label.remaining": L.remaining,
    "label.lines": L.lines,
    "label.description": L.description,
    "label.qty": L.qty,
    "label.unitPrice": L.unitPrice,
    "label.vat": L.vat,
    "label.lineTotal": L.lineTotal,
    "label.extras": L.extras,
    "label.voen": L.voen,
  };

  const whitelist = [
    ...FINANCE_INVOICE_COMMERCIAL_BASE_WHITELIST,
    ...extraKeys.map((k) => `extra.${k}`),
  ];

  for (const key of extraKeys) {
    const dotted = `extra.${key}`;
    values[dotted] = Object.prototype.hasOwnProperty.call(rawExtras, key)
      ? scalarExtra(rawExtras[key])
      : null;
  }

  const lines: PrintSnapshotLine[] = inv.items.slice(0, PRINT_LINES_MAX).map((it) => ({
    "line.description": it.description ?? it.product?.name ?? "",
    "line.sku": it.product?.sku ?? "",
    "line.qty": money4(it.quantity),
    "line.unitPrice": money4(it.unitPrice),
    "line.vatRate": new Decimal(it.vatRate).toFixed(2),
    "line.lineTotal": money4(it.lineTotal),
  }));

  return {
    blankId: PRINT_BLANK_FINANCE_INVOICE_COMMERCIAL,
    version: 1,
    lang,
    capturedAt: new Date().toISOString(),
    values,
    lines,
    whitelist,
    lineWhitelist: FINANCE_INVOICE_COMMERCIAL_LINE_WHITELIST,
  };
}

/** Checked-in vendor HTML blank (placeholders only). Fragment for inject + print. */
export function financeInvoiceCommercialTemplate(): string {
  return `<style>
  .fin-inv-print{font-family:system-ui,Segoe UI,sans-serif;color:#1a1a1a;margin:24px;font-size:13px}
  .fin-inv-print .no-print{margin-bottom:16px}
  @media print{.fin-inv-print .no-print{display:none!important}}
  .fin-inv-print .hdr{display:flex;gap:16px;align-items:flex-start;margin-bottom:20px}
  .fin-inv-print .logo{max-height:64px;max-width:160px}
  .fin-inv-print h1{font-size:18px;margin:0 0 8px}
  .fin-inv-print table{width:100%;border-collapse:collapse;margin-top:12px}
  .fin-inv-print th,.fin-inv-print td{border:1px solid #ccc;padding:6px 8px;text-align:left}
  .fin-inv-print th{background:#f5f5f5}
  .fin-inv-print .tot{margin-top:16px;text-align:right}
  .fin-inv-print .extras{margin-top:16px}
  .fin-inv-print .muted{color:#666;font-size:12px}
</style>
<div class="fin-inv-print">
  <div class="no-print"><button type="button" onclick="window.print()">Print</button></div>
  <div class="hdr">
    __LOGO__
    <div>
      <h1>{{label.title}} {{invoice.number}}</h1>
      <div><strong>{{org.name}}</strong></div>
      <div class="muted">{{label.voen}}: {{org.taxId}}</div>
      <div class="muted">{{org.legalAddress}}</div>
      <div class="muted">{{org.bankLine}}</div>
    </div>
  </div>
  <p><strong>{{label.buyer}}:</strong> {{buyer.name}} · {{label.voen}}: {{buyer.taxId}}</p>
  <p><strong>{{label.due}}:</strong> {{invoice.dueDate}} · {{invoice.status}} · {{invoice.currency}}
    {{invoice.tradeContext}}</p>
  <h2>{{label.lines}}</h2>
  <table>
    <thead>
      <tr>
        <th>{{label.description}}</th>
        <th>{{label.qty}}</th>
        <th>{{label.unitPrice}}</th>
        <th>{{label.vat}}</th>
        <th>{{label.lineTotal}}</th>
      </tr>
    </thead>
    <tbody>
      {{#lines}}
      <tr>
        <td>{{line.description}}</td>
        <td>{{line.qty}}</td>
        <td>{{line.unitPrice}}</td>
        <td>{{line.vatRate}}</td>
        <td>{{line.lineTotal}}</td>
      </tr>
      {{/lines}}
    </tbody>
  </table>
  <div class="tot">
    <div>{{label.total}}: {{invoice.total}} {{invoice.currency}}</div>
    <div>{{label.paid}}: {{invoice.paid}}</div>
    <div>{{label.remaining}}: {{invoice.remaining}}</div>
  </div>
  __EXTRAS__
</div>`;
}

export function renderFinanceInvoiceCommercialHtml(
  snapshot: InvoicePrintSnapshotResult,
): { ok: true; html: string } | { ok: false; issue: PrintSnapshotIssue } {
  let template = financeInvoiceCommercialTemplate();
  const logoSrc = safePrintLogoSrc(snapshot.values["org.logoUrl"]);
  if (logoSrc) {
    template = template.replace(
      "__LOGO__",
      `<img class="logo" src="${escapeHtmlAttr(logoSrc)}" alt="" />`,
    );
  } else {
    template = template.replace("__LOGO__", "");
  }

  const extraEntries = Object.entries(snapshot.values).filter(
    ([k, v]) => k.startsWith("extra.") && v != null && String(v).length > 0,
  );
  if (extraEntries.length > 0) {
    const block =
      `<div class="extras"><h2>{{label.extras}}</h2><ul>` +
      extraEntries
        .map(([k]) => {
          const keyName = k.slice("extra.".length);
          return `<li><strong>${escapeHtmlAttr(keyName)}:</strong> {{${k}}}</li>`;
        })
        .join("") +
      `</ul></div>`;
    template = template.replace("__EXTRAS__", block);
  } else {
    template = template.replace("__EXTRAS__", "");
  }

  // org.logoUrl is not in the interpolator template after __LOGO__ swap
  const result = interpolatePrintTemplate(
    template,
    snapshot,
    snapshot.whitelist,
    snapshot.lineWhitelist,
  );
  if (!result.ok) return result;
  return { ok: true, html: result.html };
}
