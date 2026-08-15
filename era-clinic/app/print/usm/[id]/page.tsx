import { notFound } from "next/navigation";
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
