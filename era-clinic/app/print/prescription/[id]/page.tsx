import { notFound } from "next/navigation";
import { PrintShell } from "@/components/print/PrintShell";
import { getPrintBranding } from "@/domain/print/print-branding.service";
import { printLabel } from "@/domain/print/print-labels";
import { enterPrintSession } from "@/domain/print/print-session";
import { normalizePrintLang, type PrintLang } from "@/domain/print/print-types";
import { getPrescriptionForPrint } from "@/domain/prescription/prescription.service";

const TITLE: Record<PrintLang, string> = {
  en: "Prescription",
  ru: "Рецепт",
  az: "Resept",
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string; autoprint?: string }>;
};

export default async function PrintPrescriptionPage({ params, searchParams }: Props) {
  await enterPrintSession();
  const { id } = await params;
  const sp = await searchParams;
  const lang = normalizePrintLang(sp.lang);
  const [row, branding] = await Promise.all([
    getPrescriptionForPrint(id),
    getPrintBranding(lang),
  ]);
  if (!row) notFound();

  return (
    <PrintShell
      lang={lang}
      branding={branding}
      title={TITLE[lang]}
      autoPrint={sp.autoprint === "1"}
      signatureLabel={printLabel(lang, "doctor")}
      signatureName={row.visit?.practitioner?.fullName ?? null}
    >
      <div className="space-y-4 text-sm">
        <p>
          <strong>{row.patientRef?.fullName}</strong> ({row.patientRef?.refCode})
        </p>
        <p>
          {printLabel(lang, "doctor")}: {row.visit?.practitioner?.fullName ?? "—"}
        </p>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b">
              <th className="py-1">SKU</th>
              <th className="py-1">Qty</th>
              <th className="py-1">Sig</th>
            </tr>
          </thead>
          <tbody>
            {row.lines.map((line, i) => (
              <tr key={line.id ?? i} className="border-b border-slate-200">
                <td className="py-1">
                  {line.medication?.tradeName ?? line.medication?.innName ?? line.sku ?? "—"}
                </td>
                <td className="py-1">{String(line.qty)}</td>
                <td className="py-1">
                  {[line.dose, line.frequency, line.instructions].filter(Boolean).join(" · ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PrintShell>
  );
}
