import { notFound } from "next/navigation";
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
      <div className="mb-3 text-[11px]">
        <strong>{printLabel(lang, "diagnosis")}:</strong>{" "}
        {doc.diagnoses.length > 0 ? doc.diagnoses.join("; ") : "—"}
      </div>
      <ol className="m-0 list-decimal space-y-4 pl-5">
        {doc.sections
          .filter((sec) => sec.enabled)
          .map((sec) => (
          <li key={sec.specialty} className="text-[11px]">
            <div className="font-semibold uppercase">
              {sec.title}
              {sec.doctorName ? ` — ${sec.doctorName}` : ""}
              {sec.scheduleHint ? ` (${sec.scheduleHint})` : ""}
              {sec.status ? ` [${sec.status}]` : ""}
            </div>
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
          </li>
        ))}
      </ol>
    </PrintShell>
  );
}
