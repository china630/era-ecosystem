"use client";

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
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-root { padding: 0; max-width: none; }
        }
      `}</style>
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
