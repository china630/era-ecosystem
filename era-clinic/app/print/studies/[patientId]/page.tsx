import { notFound } from "next/navigation";
import { PrintShell } from "@/components/print/PrintShell";
import { buildStudiesPrint } from "@/domain/print/print-studies.service";
import { printLabel } from "@/domain/print/print-labels";
import { normalizePrintLang } from "@/domain/print/print-types";
import { enterPrintSession } from "@/domain/print/print-session";
import type { PrintLang } from "@/domain/print/print-types";

function studyStatusLabel(lang: PrintLang, status: string): string {
  const labKey = `labStatus_${status}`;
  const lab = printLabel(lang, labKey);
  if (lab !== labKey) return lab;
  const procKey = `procStatus_${status}`;
  const proc = printLabel(lang, procKey);
  return proc !== procKey ? proc : status;
}

type Props = {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{ lang?: string; autoprint?: string; episode?: string }>;
};

export default async function PrintStudiesPage({ params, searchParams }: Props) {
  await enterPrintSession();
  const { patientId } = await params;
  const sp = await searchParams;
  const lang = normalizePrintLang(sp.lang);
  const doc = await buildStudiesPrint(patientId, lang, sp.episode);
  if (!doc) notFound();

  return (
    <PrintShell
      lang={lang}
      branding={doc.branding}
      patient={doc.patient}
      title={printLabel(lang, "labs")}
      autoPrint={sp.autoprint === "1"}
    >
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="border-b border-black">
            <th className="p-1 text-left">{printLabel(lang, "no")}</th>
            <th className="p-1 text-left">{printLabel(lang, "procedureName")}</th>
            <th className="p-1 text-left">{printLabel(lang, "date")}</th>
            <th className="p-1 text-left">{printLabel(lang, "status")}</th>
          </tr>
        </thead>
        <tbody>
          {doc.rows.map((row, index) => (
            <tr key={`${row.name}-${index}`} className="border-b border-neutral-300">
              <td className="p-1">{index + 1}</td>
              <td className="p-1">{row.name}</td>
              <td className="p-1">{row.when}</td>
              <td className="p-1">{studyStatusLabel(lang, row.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PrintShell>
  );
}
