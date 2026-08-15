/**
 * Print UI components and routes
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

write(
  "src/components/print/PrintLanguageDialog.tsx",
  `"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FieldSelect, ModalFooter, ModalShell } from "@era/satellite-kit/ui";
import type { PrintLang } from "@/domain/print/print-types";
import { normalizePrintLang } from "@/domain/print/print-types";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Path without query, e.g. /print/lab-order/abc */
  href: string | null;
  title?: string;
};

export function PrintLanguageDialog({ open, onClose, href, title }: Props) {
  const locale = useLocale();
  const t = useTranslations("print");
  const [lang, setLang] = useState<PrintLang>(normalizePrintLang(locale));

  useEffect(() => {
    if (open) setLang(normalizePrintLang(locale));
  }, [open, locale]);

  function submit() {
    if (!href) return;
    const url = \`\${href}?lang=\${lang}&autoprint=1\`;
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  }

  return (
    <ModalShell open={open} title={title ?? t("chooseLanguage")} onClose={onClose}>
      <FieldSelect
        label={t("chooseLanguage")}
        preset="select"
        value={lang}
        onChange={(e) => setLang(normalizePrintLang(e.target.value))}
      >
        <option value="az">Azərbaycan</option>
        <option value="ru">Русский</option>
        <option value="en">English</option>
      </FieldSelect>
      <ModalFooter
        onCancel={onClose}
        onSubmit={submit}
        submitLabel={t("print")}
        cancelLabel={t("cancel")}
      />
    </ModalShell>
  );
}
`,
);

write(
  "src/components/print/PrintShell.tsx",
  `"use client";

import { useEffect } from "react";
import type { PrintBranding, PrintLang, PrintPatientStrip } from "@/domain/print/print-types";
import { printLabel } from "@/domain/print/print-labels";

type Props = {
  lang: PrintLang;
  branding: PrintBranding;
  patient?: PrintPatientStrip | null;
  title: string;
  autoPrint?: boolean;
  children: React.ReactNode;
  signatureLabel?: string;
  signatureName?: string | null;
};

function sexLabel(lang: PrintLang, sex: string | null | undefined): string {
  if (!sex) return printLabel(lang, "unknown");
  if (sex === "MALE") return printLabel(lang, "male");
  if (sex === "FEMALE") return printLabel(lang, "female");
  return printLabel(lang, "unknown");
}

export function PrintShell({
  lang,
  branding,
  patient,
  title,
  autoPrint,
  children,
  signatureLabel,
  signatureName,
}: Props) {
  useEffect(() => {
    if (!autoPrint) return;
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, [autoPrint]);

  return (
    <div className="print-root mx-auto max-w-[210mm] bg-white p-6 text-[12px] text-black">
      <style>{\`
        @page { size: A4; margin: 12mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-root { padding: 0; max-width: none; }
        }
      \`}</style>
      <div className="no-print mb-4 flex justify-end gap-2">
        <button
          type="button"
          className="rounded border px-3 py-1 text-[13px]"
          onClick={() => window.print()}
        >
          {printLabel(lang, "print")}
        </button>
      </div>

      <header className="mb-4 flex items-start justify-between gap-4 border-b border-black pb-3">
        <div className="flex items-start gap-3">
          {branding.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoDataUrl} alt="" className="h-14 w-auto object-contain" />
          ) : null}
          <div>
            <h1 className="m-0 text-[18px] font-bold uppercase tracking-wide">{branding.clinicName}</h1>
            {branding.address ? <p className="m-0 mt-1 text-[11px]">{branding.address}</p> : null}
            <p className="m-0 mt-1 text-[11px]">
              {[branding.phone, branding.email, branding.website].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="text-right text-[11px]">
          <p className="m-0 font-semibold">{printLabel(lang, "date")}</p>
          <p className="m-0">{patient?.date ?? ""}</p>
        </div>
      </header>

      <h2 className="mb-3 text-center text-[16px] font-bold uppercase">{title}</h2>

      {patient ? (
        <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1 border border-black p-2 text-[11px]">
          <div>
            <strong>{printLabel(lang, "patient")}:</strong> {patient.fullName}
          </div>
          <div>
            <strong>{printLabel(lang, "country")}:</strong> {patient.nationality ?? "—"}
          </div>
          <div>
            <strong>{printLabel(lang, "sex")}:</strong> {sexLabel(lang, patient.sex)}
          </div>
          <div>
            <strong>{printLabel(lang, "birthDate")}:</strong> {patient.birthDate ?? "—"}
          </div>
          <div>
            <strong>{printLabel(lang, "phone")}:</strong> {patient.phone ?? "—"}
          </div>
          <div>
            <strong>{printLabel(lang, "roomNo")}:</strong> {patient.roomNumber ?? "—"}
          </div>
          {patient.doctorName ? (
            <div>
              <strong>{printLabel(lang, "doctor")}:</strong> {patient.doctorName}
            </div>
          ) : null}
        </div>
      ) : null}

      {children}

      {(signatureName || signatureLabel) && (
        <div className="mt-8 flex items-end justify-between">
          <div>
            <p className="m-0">
              {signatureLabel ?? printLabel(lang, "labDoctor")}: {signatureName ?? ""}
            </p>
            <p className="mt-6 m-0">
              {printLabel(lang, "signature")}: ________________
            </p>
          </div>
        </div>
      )}

      {branding.footer ? (
        <footer className="mt-6 border-t border-black pt-2 text-[10px] text-neutral-700">
          {branding.footer}
        </footer>
      ) : null}
    </div>
  );
}
`,
);

write(
  "app/print/layout.tsx",
  `import type { ReactNode } from "react";

export default function PrintLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-100 text-black antialiased">{children}</body>
    </html>
  );
}
`,
);

write(
  "app/print/lab-order/[id]/page.tsx",
  `import { notFound } from "next/navigation";
import { PrintShell } from "@/components/print/PrintShell";
import { buildLabOrderPrint } from "@/domain/print/print-lab.service";
import { printLabel } from "@/domain/print/print-labels";
import { normalizePrintLang } from "@/domain/print/print-types";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string; autoprint?: string }>;
};

export default async function PrintLabOrderPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const lang = normalizePrintLang(sp.lang);
  const doc = await buildLabOrderPrint(id, lang);
  if (!doc) notFound();

  return (
    <PrintShell
      lang={lang}
      branding={doc.branding}
      patient={doc.patient}
      title={doc.title}
      autoPrint={sp.autoprint === "1"}
      signatureLabel={printLabel(lang, "labDoctor")}
      signatureName={doc.signatureLab}
    >
      {doc.sections.map((sec) => (
        <div key={sec.key || "default"} className="mb-4">
          {sec.title ? (
            <h3 className="mb-1 border-b border-black text-[12px] font-semibold uppercase">
              {sec.title}
            </h3>
          ) : null}
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-black">
                <th className="p-1 text-left">{printLabel(lang, "no")}</th>
                <th className="p-1 text-left">{printLabel(lang, "parameter")}</th>
                <th className="p-1 text-left">{printLabel(lang, "result")}</th>
                <th className="p-1 text-left">{printLabel(lang, "norm")}</th>
              </tr>
            </thead>
            <tbody>
              {sec.rows.map((r) => (
                <tr key={\`\${r.no}-\${r.code}\`} className="border-b border-neutral-300">
                  <td className="p-1 align-top">{r.no}</td>
                  <td className="p-1 align-top">
                    {r.label}
                    {r.flag !== "NORMAL" ? (
                      <span className="ml-1 font-bold">({r.flag})</span>
                    ) : null}
                  </td>
                  <td className="p-1 align-top font-medium">{r.value}</td>
                  <td className="p-1 align-top">{r.norm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </PrintShell>
  );
}
`,
);

write(
  "app/print/usm/[id]/page.tsx",
  `import { notFound } from "next/navigation";
import { PrintShell } from "@/components/print/PrintShell";
import { buildUsmPrint } from "@/domain/print/print-usm.service";
import { printLabel } from "@/domain/print/print-labels";
import { normalizePrintLang } from "@/domain/print/print-types";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string; autoprint?: string }>;
};

export default async function PrintUsmPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const lang = normalizePrintLang(sp.lang);
  const doc = await buildUsmPrint(id, lang);
  if (!doc) notFound();

  return (
    <PrintShell
      lang={lang}
      branding={doc.branding}
      patient={doc.patient}
      title={doc.title}
      autoPrint={sp.autoprint === "1"}
      signatureLabel={printLabel(lang, "radiologist")}
      signatureName={doc.signatureDoctor}
    >
      <div className="whitespace-pre-wrap text-[12px] leading-relaxed">{doc.narrative}</div>
    </PrintShell>
  );
}
`,
);

write(
  "app/print/checkup/[patientId]/page.tsx",
  `import { notFound } from "next/navigation";
import { PrintShell } from "@/components/print/PrintShell";
import { buildCheckupPrint } from "@/domain/print/print-checkup.service";
import { printLabel } from "@/domain/print/print-labels";
import { normalizePrintLang } from "@/domain/print/print-types";

type Props = {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{ lang?: string; autoprint?: string }>;
};

export default async function PrintCheckupPage({ params, searchParams }: Props) {
  const { patientId } = await params;
  const sp = await searchParams;
  const lang = normalizePrintLang(sp.lang);
  const doc = await buildCheckupPrint(patientId, lang);
  if (!doc) notFound();

  return (
    <PrintShell
      lang={lang}
      branding={doc.branding}
      patient={doc.patient}
      title={printLabel(lang, "checkupList")}
      autoPrint={sp.autoprint === "1"}
    >
      <div className="mb-3 grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <strong>{printLabel(lang, "arrival")}:</strong> {doc.arrival ?? "—"}
        </div>
        <div>
          <strong>{printLabel(lang, "departure")}:</strong> {doc.departure ?? "—"}
        </div>
        <div>
          <strong>{printLabel(lang, "height")}:</strong> __________
        </div>
        <div>
          <strong>{printLabel(lang, "weight")}:</strong> __________
        </div>
      </div>
      <p className="mb-3 text-[11px]">
        <strong>{printLabel(lang, "workingHours")}:</strong> {printLabel(lang, "weekdays")} 09:00–17:00 ·{" "}
        {printLabel(lang, "saturday")} 09:00–13:00
      </p>
      <ol className="m-0 list-decimal space-y-4 pl-5">
        {doc.sections.map((sec) => (
          <li key={sec.specialty} className="text-[11px]">
            <div className="font-semibold uppercase">
              {sec.title}
              {sec.doctorName ? \` — \${sec.doctorName}\` : ""}
              {sec.scheduleHint ? \` (\${sec.scheduleHint})\` : ""}
            </div>
            {!sec.enabled ? (
              <p className="italic">{printLabel(lang, "temporarilyUnavailable")}</p>
            ) : (
              <div className="mt-1 space-y-1">
                {sec.specialty === "therapist" ? (
                  <>
                    <p>
                      {printLabel(lang, "bloodPressure")}: __________ {printLabel(lang, "pulse")}: __________{" "}
                      {printLabel(lang, "respiration")}: __________
                    </p>
                    <p>{printLabel(lang, "exam")}: _______________________________________________</p>
                  </>
                ) : null}
                <p>{printLabel(lang, "naftalanOpinion")}: _______________________________________</p>
                <p>{printLabel(lang, "doctorComment")}: _________________________________________</p>
              </div>
            )}
          </li>
        ))}
      </ol>
    </PrintShell>
  );
}
`,
);

write(
  "app/print/procedures/[patientId]/page.tsx",
  `import { notFound } from "next/navigation";
import { PrintShell } from "@/components/print/PrintShell";
import { buildProceduresPrint } from "@/domain/print/print-procedures.service";
import { printLabel } from "@/domain/print/print-labels";
import { normalizePrintLang } from "@/domain/print/print-types";

type Props = {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{ lang?: string; autoprint?: string }>;
};

export default async function PrintProceduresPage({ params, searchParams }: Props) {
  const { patientId } = await params;
  const sp = await searchParams;
  const lang = normalizePrintLang(sp.lang);
  const doc = await buildProceduresPrint(patientId, lang);
  if (!doc) notFound();

  return (
    <PrintShell
      lang={lang}
      branding={doc.branding}
      patient={doc.patient}
      title={printLabel(lang, "procedures")}
      autoPrint={sp.autoprint === "1"}
    >
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="border-b border-black">
            <th className="p-1 text-left">{printLabel(lang, "no")}</th>
            <th className="p-1 text-left">{printLabel(lang, "procedureName")}</th>
            <th className="p-1 text-left">{printLabel(lang, "quantity")}</th>
            <th className="p-1 text-left">{printLabel(lang, "time")}</th>
            <th className="p-1 text-left">{printLabel(lang, "room")}</th>
            <th className="p-1 text-left">{printLabel(lang, "doctor")}</th>
            <th className="p-1 text-left">{printLabel(lang, "price")}</th>
            <th className="p-1 text-left">{printLabel(lang, "note")}</th>
          </tr>
        </thead>
        <tbody>
          {doc.rowsByDate.map((group) => (
            <>
              <tr key={\`d-\${group.date}\`} className="bg-neutral-100">
                <td colSpan={8} className="p-1 font-semibold">
                  {group.date}
                </td>
              </tr>
              {group.rows.map((r) => (
                <tr key={r.no} className="border-b border-neutral-300 align-top">
                  <td className="p-1">{r.no}</td>
                  <td className="p-1">{r.name}</td>
                  <td className="p-1">{r.quantity}</td>
                  <td className="p-1">{r.time}</td>
                  <td className="p-1">{r.room}</td>
                  <td className="p-1">{r.doctor}</td>
                  <td className="p-1">{r.price}</td>
                  <td className="p-1">{r.note}</td>
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </PrintShell>
  );
}
`,
);

console.log("print ui done");
