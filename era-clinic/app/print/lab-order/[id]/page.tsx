import { notFound } from "next/navigation";
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
                <tr key={`${r.no}-${r.code}`} className="border-b border-neutral-300">
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
