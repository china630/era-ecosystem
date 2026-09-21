import { WorkforcePersonnelOrderType } from "@era365/database";

export const ORDER_NUMBER_PREFIX: Record<WorkforcePersonnelOrderType, string> = {
  HIRE: "EQ",
  TRANSFER: "EY",
  TERMINATE: "EX",
  LEAVE_ANNUAL: "EM",
};

export function formatOrderNumber(
  type: WorkforcePersonnelOrderType,
  year: number,
  seq: number,
): string {
  return `${ORDER_NUMBER_PREFIX[type]}-${year}-${String(seq).padStart(5, "0")}`;
}

/** Built-in Evrostar-style blanks (az/ru). Org/holding rows override these. */
export const DEFAULT_ORDER_TEMPLATES: Array<{
  type: WorkforcePersonnelOrderType;
  locale: "az" | "ru";
  name: string;
  bodyHtml: string;
  placeholders: string[];
}> = [
  {
    type: "HIRE",
    locale: "az",
    name: "İşə qəbul əmri (default)",
    placeholders: [
      "order.number",
      "order.effectiveDate",
      "person.fullName",
      "employment.position",
      "employment.orgUnit",
      "org.name",
      "org.voen",
      "salary.contract",
      "order.note",
    ],
    bodyHtml: `<h1>İŞƏ QƏBUL ƏMRİ</h1>
<p><strong>{{org.name}}</strong> (VÖEN: {{org.voen}})</p>
<p>Əmr № <strong>{{order.number}}</strong> &nbsp; Tarix: {{order.effectiveDate}}</p>
<p>{{person.fullName}} adlı şəxs {{employment.position}} vəzifəsinə ({{employment.orgUnit}}) {{order.effectiveDate}} tarixdən işə qəbul edilsin.</p>
<p>Müqavilə əməkhaqqı: {{salary.contract}} AZN</p>
<p>Əsas: {{order.note}}</p>
<p>__________________ &nbsp; HR / Rəhbər</p>`,
  },
  {
    type: "HIRE",
    locale: "ru",
    name: "Приказ о приёме (default)",
    placeholders: [
      "order.number",
      "order.effectiveDate",
      "person.fullName",
      "employment.position",
      "employment.orgUnit",
      "org.name",
      "org.voen",
      "salary.contract",
      "order.note",
    ],
    bodyHtml: `<h1>ПРИКАЗ О ПРИЁМЕ НА РАБОТУ</h1>
<p><strong>{{org.name}}</strong> (ВН: {{org.voen}})</p>
<p>№ <strong>{{order.number}}</strong> &nbsp; Дата: {{order.effectiveDate}}</p>
<p>Принять {{person.fullName}} на должность {{employment.position}} ({{employment.orgUnit}}) с {{order.effectiveDate}}.</p>
<p>Оклад по договору: {{salary.contract}} AZN</p>
<p>Основание: {{order.note}}</p>
<p>__________________ &nbsp; HR / Руководитель</p>`,
  },
  {
    type: "TERMINATE",
    locale: "az",
    name: "Xitam əmri (default)",
    placeholders: [
      "order.number",
      "order.effectiveDate",
      "person.fullName",
      "employment.position",
      "employment.orgUnit",
      "org.name",
      "org.voen",
      "order.note",
    ],
    bodyHtml: `<h1>ƏMƏK MÜQAVİLƏSİNƏ XİTAM ƏMRİ</h1>
<p><strong>{{org.name}}</strong> (VÖEN: {{org.voen}})</p>
<p>Əmr № <strong>{{order.number}}</strong> &nbsp; Tarix: {{order.effectiveDate}}</p>
<p>{{person.fullName}} ({{employment.position}}, {{employment.orgUnit}}) ilə əmək müqaviləsinə {{order.effectiveDate}} tarixdən xitam verilsin.</p>
<p>Əsas: {{order.note}}</p>
<p>__________________ &nbsp; HR / Rəhbər</p>`,
  },
  {
    type: "TERMINATE",
    locale: "ru",
    name: "Приказ об увольнении (default)",
    placeholders: [
      "order.number",
      "order.effectiveDate",
      "person.fullName",
      "employment.position",
      "employment.orgUnit",
      "org.name",
      "org.voen",
      "order.note",
    ],
    bodyHtml: `<h1>ПРИКАЗ О ПРЕКРАЩЕНИИ ТРУДОВОГО ДОГОВОРА</h1>
<p><strong>{{org.name}}</strong> (ВН: {{org.voen}})</p>
<p>№ <strong>{{order.number}}</strong> &nbsp; Дата: {{order.effectiveDate}}</p>
<p>Прекратить трудовой договор с {{person.fullName}} ({{employment.position}}, {{employment.orgUnit}}) с {{order.effectiveDate}}.</p>
<p>Основание: {{order.note}}</p>
<p>__________________ &nbsp; HR / Руководитель</p>`,
  },
  {
    type: "LEAVE_ANNUAL",
    locale: "az",
    name: "Məzuniyyət əmri (default)",
    placeholders: [
      "order.number",
      "order.effectiveDate",
      "person.fullName",
      "employment.position",
      "org.name",
      "leave.remainingDays",
      "leave.startDate",
      "leave.endDate",
      "order.note",
    ],
    bodyHtml: `<h1>ƏMƏK MƏZUNİYYƏTİ ƏMRİ</h1>
<p><strong>{{org.name}}</strong></p>
<p>Əmr № <strong>{{order.number}}</strong> &nbsp; Tarix: {{order.effectiveDate}}</p>
<p>{{person.fullName}} ({{employment.position}}) {{leave.startDate}}–{{leave.endDate}} tarixlərində illik məzuniyyətə buraxılsın.</p>
<p>Qalıq məzuniyyət günləri (Finance): {{leave.remainingDays}}</p>
<p>Əsas: {{order.note}}</p>
<p>__________________ &nbsp; HR / Rəhbər</p>`,
  },
  {
    type: "LEAVE_ANNUAL",
    locale: "ru",
    name: "Приказ на отпуск (default)",
    placeholders: [
      "order.number",
      "order.effectiveDate",
      "person.fullName",
      "employment.position",
      "org.name",
      "leave.remainingDays",
      "leave.startDate",
      "leave.endDate",
      "order.note",
    ],
    bodyHtml: `<h1>ПРИКАЗ О ПРЕДОСТАВЛЕНИИ ОТПУСКА</h1>
<p><strong>{{org.name}}</strong></p>
<p>№ <strong>{{order.number}}</strong> &nbsp; Дата: {{order.effectiveDate}}</p>
<p>Предоставить {{person.fullName}} ({{employment.position}}) ежегодный отпуск с {{leave.startDate}} по {{leave.endDate}}.</p>
<p>Остаток дней отпуска (Finance): {{leave.remainingDays}}</p>
<p>Основание: {{order.note}}</p>
<p>__________________ &nbsp; HR / Руководитель</p>`,
  },
  {
    type: "TRANSFER",
    locale: "az",
    name: "Yerdəyişmə əmri (default)",
    placeholders: [
      "order.number",
      "order.effectiveDate",
      "person.fullName",
      "employment.position",
      "employment.orgUnit",
      "org.name",
      "order.note",
    ],
    bodyHtml: `<h1>YERDƏYİŞMƏ ƏMRİ</h1>
<p><strong>{{org.name}}</strong></p>
<p>Əmr № <strong>{{order.number}}</strong> &nbsp; Tarix: {{order.effectiveDate}}</p>
<p>{{person.fullName}} {{employment.orgUnit}} / {{employment.position}} vəzifəsinə köçürülsün.</p>
<p>Əsas: {{order.note}}</p>`,
  },
  {
    type: "TRANSFER",
    locale: "ru",
    name: "Приказ о переводе (default)",
    placeholders: [
      "order.number",
      "order.effectiveDate",
      "person.fullName",
      "employment.position",
      "employment.orgUnit",
      "org.name",
      "order.note",
    ],
    bodyHtml: `<h1>ПРИКАЗ О ПЕРЕВОДЕ</h1>
<p><strong>{{org.name}}</strong></p>
<p>№ <strong>{{order.number}}</strong> &nbsp; Дата: {{order.effectiveDate}}</p>
<p>Перевести {{person.fullName}} в {{employment.orgUnit}} / {{employment.position}}.</p>
<p>Основание: {{order.note}}</p>`,
  },
];

export function lookupPath(
  ctx: Record<string, unknown>,
  path: string,
): string {
  const parts = path.split(".");
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return "";
    cur = (cur as Record<string, unknown>)[p];
  }
  if (cur == null || cur === "") return "—";
  return String(cur);
}

export function applyTemplatePlaceholders(
  bodyHtml: string,
  ctx: Record<string, unknown>,
): string {
  return bodyHtml.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, path: string) =>
    lookupPath(ctx, path),
  );
}

/** Minimal HTML → plain text for pdfkit (no browser engine). */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<\/(p|div|h[1-6]|tr|li|br)\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
