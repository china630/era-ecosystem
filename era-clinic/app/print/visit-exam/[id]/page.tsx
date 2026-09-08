import { notFound, redirect } from "next/navigation";
import { PrintShell } from "@/components/print/PrintShell";
import { buildVisitExamPrint } from "@/domain/print/print-visit-exam.service";
import { printLabel } from "@/domain/print/print-labels";
import { normalizePrintLang } from "@/domain/print/print-types";
import { assertVisitExamPrintAccess } from "@/lib/auth/assert-visit-exam-print-access";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string; autoprint?: string }>;
};

export default async function PrintVisitExamPage({ params, searchParams }: Props) {
  const access = await assertVisitExamPrintAccess();
  if (access === "unauthenticated") redirect("/login");
  if (access === "forbidden") redirect("/login?error=forbidden");

  const { id } = await params;
  const sp = await searchParams;
  const lang = normalizePrintLang(sp.lang);
  const doc = await buildVisitExamPrint(id, lang);
  if (!doc) notFound();

  return (
    <PrintShell
      lang={lang}
      branding={doc.branding}
      patient={doc.patient}
      title={doc.title}
      autoPrint={sp.autoprint === "1"}
      signatureLabel={printLabel(lang, "doctor")}
      signatureName={doc.signatureDoctor}
    >
      <div className="mb-3 text-[11px]">
        <strong>{printLabel(lang, "diagnosis")}:</strong>{" "}
        {doc.diagnoses.length > 0 ? doc.diagnoses.join("; ") : "—"}
      </div>
      {doc.rows.length === 0 ? (
        <p className="text-[12px] italic">{printLabel(lang, "visitExamEmpty")}</p>
      ) : (
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-black text-left">
              <th className="py-1 pr-2 font-semibold">{printLabel(lang, "parameter")}</th>
              <th className="py-1 pr-2 font-semibold">{printLabel(lang, "result")}</th>
              <th className="py-1 pr-2 font-semibold">{printLabel(lang, "unit")}</th>
              <th className="py-1 font-semibold">{printLabel(lang, "norm")}</th>
            </tr>
          </thead>
          <tbody>
            {doc.rows.map((row, i) => (
              <tr key={`${row.label}-${i}`} className="border-b border-neutral-300 align-top">
                <td className="py-1 pr-2">{row.label}</td>
                <td className="py-1 pr-2 whitespace-pre-wrap">{row.value}</td>
                <td className="py-1 pr-2">{row.unit ?? ""}</td>
                <td className="py-1">{row.ref ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PrintShell>
  );
}
