import { notFound } from "next/navigation";
import { PrintShell } from "@/components/print/PrintShell";
import { buildEpisodeSummaryPrint } from "@/domain/print/print-episode-summary.service";
import { printLabel } from "@/domain/print/print-labels";
import { normalizePrintLang } from "@/domain/print/print-types";
import { enterPrintSession } from "@/domain/print/print-session";

type Props = {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{ lang?: string; autoprint?: string; episode?: string }>;
};

function Section({
  title,
  lines,
  empty,
}: {
  title: string;
  lines: Array<{ when: string; title: string; detail: string }>;
  empty: string;
}) {
  return (
    <section className="mb-4">
      <h2 className="mb-1 text-[12px] font-semibold uppercase tracking-wide">{title}</h2>
      {lines.length === 0 ? (
        <p className="m-0 text-[11px]">— {empty}</p>
      ) : (
        <table className="w-full border-collapse text-[11px]">
          <tbody>
            {lines.map((line, i) => (
              <tr key={`${line.when}-${i}`} className="border-b border-neutral-300 align-top">
                <td className="w-[22%] py-1 pr-2 whitespace-nowrap">{line.when}</td>
                <td className="py-1">
                  <div>{line.title}</div>
                  {line.detail ? <div className="text-[10px]">{line.detail}</div> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default async function PrintEpisodeSummaryPage({ params, searchParams }: Props) {
  await enterPrintSession();
  const { patientId } = await params;
  const sp = await searchParams;
  const lang = normalizePrintLang(sp.lang);
  const doc = await buildEpisodeSummaryPrint(patientId, lang, sp.episode);
  if (!doc) notFound();

  return (
    <PrintShell
      lang={lang}
      branding={doc.branding}
      patient={doc.patient}
      title={printLabel(lang, "episodeSummary")}
      autoPrint={sp.autoprint === "1"}
    >
      {doc.courseOpen ? (
        <p className="mb-3 text-[11px] italic">{printLabel(lang, "episodeSummaryInterim")}</p>
      ) : null}
      <p className="mb-3 text-[11px]">
        {doc.programCode ? (
          <>
            <strong>{printLabel(lang, "program")}:</strong> {doc.programCode}
            {" · "}
          </>
        ) : null}
        {doc.origin ? (
          <>
            <strong>{printLabel(lang, "origin")}:</strong>{" "}
            {printLabel(lang, doc.origin === "WALK_IN" ? "originWalkIn" : "originInHouse")}
          </>
        ) : null}
      </p>
      <section className="mb-4">
        <h2 className="mb-1 text-[12px] font-semibold uppercase tracking-wide">
          {printLabel(lang, "anamnesis")}
        </h2>
        <p className="m-0 whitespace-pre-wrap text-[11px]">
          {doc.anamnesis || `— ${printLabel(lang, "episodeSummaryEmpty")}`}
        </p>
      </section>
      <Section
        title={printLabel(lang, "complaints")}
        lines={doc.complaints}
        empty={printLabel(lang, "episodeSummaryEmpty")}
      />
      <Section
        title={printLabel(lang, "diagnoses")}
        lines={doc.diagnoses}
        empty={printLabel(lang, "episodeSummaryEmpty")}
      />
      <Section
        title={printLabel(lang, "labs")}
        lines={doc.labs}
        empty={printLabel(lang, "episodeSummaryEmpty")}
      />
      <Section
        title={printLabel(lang, "visitExam")}
        lines={doc.exams}
        empty={printLabel(lang, "episodeSummaryEmpty")}
      />
      <Section
        title={printLabel(lang, "procedures")}
        lines={doc.procedures}
        empty={printLabel(lang, "episodeSummaryEmpty")}
      />
    </PrintShell>
  );
}
