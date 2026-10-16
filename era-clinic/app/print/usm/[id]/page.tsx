import { notFound } from "next/navigation";
import { PrintShell } from "@/components/print/PrintShell";
import { buildUsmPrint } from "@/domain/print/print-usm.service";
import { printLabel } from "@/domain/print/print-labels";
import { normalizePrintLang } from "@/domain/print/print-types";
import { enterPrintSession } from "@/domain/print/print-session";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string; autoprint?: string }>;
};

export default async function PrintUsmPage({ params, searchParams }: Props) {
  await enterPrintSession();
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
      {doc.rows.length === 0 ? (
        <p className="text-[12px]">—</p>
      ) : (
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-black">
              <th className="py-1 pr-2 text-left">{printLabel(lang, "parameter")}</th>
              <th className="py-1 pr-2 text-left">{printLabel(lang, "result")}</th>
              <th className="py-1 text-left">{printLabel(lang, "flag")}</th>
            </tr>
          </thead>
          <tbody>
            {doc.rows.map((row, index) => (
              <tr key={`${row.label}-${index}`} className="border-b border-neutral-300 align-top">
                <td className="py-1 pr-2">{row.label}</td>
                <td className="py-1 pr-2 whitespace-pre-wrap">{row.value}</td>
                <td className="py-1">{row.flag}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PrintShell>
  );
}
