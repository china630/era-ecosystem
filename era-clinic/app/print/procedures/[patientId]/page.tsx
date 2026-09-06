import { Fragment } from "react";
import { notFound } from "next/navigation";
import { PrintShell } from "@/components/print/PrintShell";
import { buildProceduresPrint } from "@/domain/print/print-procedures.service";
import { printLabel } from "@/domain/print/print-labels";
import { normalizePrintLang } from "@/domain/print/print-types";

type Props = {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{ lang?: string; autoprint?: string; episode?: string }>;
};

export default async function PrintProceduresPage({ params, searchParams }: Props) {
  const { patientId } = await params;
  const sp = await searchParams;
  const lang = normalizePrintLang(sp.lang);
  const doc = await buildProceduresPrint(patientId, lang, sp.episode);
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
            <Fragment key={group.date}>
              <tr className="bg-neutral-100">
                <td colSpan={8} className="p-1 font-semibold">
                  {group.date}
                </td>
              </tr>
              {group.rows.map((r) => (
                <tr key={r.no} className="border-b border-neutral-300 align-top">
                  <td className="p-1">{r.no}</td>
                  <td className="p-1">
                    <div>{r.name}</div>
                    {r.note ? (
                      <div className="mt-0.5 text-[9px] text-neutral-600">{r.note}</div>
                    ) : null}
                  </td>
                  <td className="p-1">{r.quantity}</td>
                  <td className="p-1">{r.time}</td>
                  <td className="p-1">{r.room}</td>
                  <td className="p-1">{r.doctor}</td>
                  <td className="p-1">{r.price}</td>
                  <td className="p-1">{r.note ? "—" : ""}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </PrintShell>
  );
}
