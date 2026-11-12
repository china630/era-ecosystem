import { PrintShell } from "@/components/print/PrintShell";
import {
  buildNurseDayPrint,
  buildNurseDayStaffBundle,
  type NurseDayPrintDocument,
} from "@/domain/print/print-nurse-day.service";
import { printLabel } from "@/domain/print/print-labels";
import { normalizePrintLang } from "@/domain/print/print-types";
import { enterPrintSession } from "@/domain/print/print-session";
import { getSatelliteSession } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { printDateFromYmd } from "@/domain/print/print-procedures.service";
import { todayBakuYmd } from "@/lib/baku-day";

type Props = {
  searchParams: Promise<{
    lang?: string;
    autoprint?: string;
    date?: string;
    practitionerId?: string;
    mine?: string;
    patient?: string;
    procedure?: string;
    bundle?: string;
  }>;
};

function SheetTable({
  lang,
  doc,
}: {
  lang: ReturnType<typeof normalizePrintLang>;
  doc: NurseDayPrintDocument;
}) {
  return (
    <section className="nurse-sheet">
      <p className="mb-3 text-[12px]">
        <strong>{printLabel(lang, "date")}:</strong> {doc.titleDate}
        {" · "}
        <strong>{printLabel(lang, "staff")}:</strong> {doc.staffName}
      </p>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-black">
            <th className="p-1 text-left">{printLabel(lang, "no")}</th>
            <th className="whitespace-nowrap p-1 text-left">{printLabel(lang, "time")}</th>
            <th className="p-1 text-left">{printLabel(lang, "procedureName")}</th>
            <th className="p-1 text-left">{printLabel(lang, "patient")}</th>
            <th className="whitespace-nowrap p-1 text-left">{printLabel(lang, "hotelRoom")}</th>
            <th className="p-1 text-left">{printLabel(lang, "note")}</th>
          </tr>
        </thead>
        <tbody>
          {doc.rows.map((row) => (
            <tr key={`${doc.staffName}-${row.no}`} className="border-b border-neutral-300 align-top">
              <td className="p-1">{row.no}</td>
              <td className="whitespace-nowrap p-1">{row.time}</td>
              <td className="p-1">{row.name}</td>
              <td className="p-1">{row.patient}</td>
              <td className="whitespace-nowrap p-1">{row.room}</td>
              <td className="p-1">
                {row.zones ? <div>{row.zones}</div> : null}
                {row.settings ? <div className="mt-0.5">{row.settings}</div> : null}
                {row.note ? <div className="mt-0.5">{row.note}</div> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default async function PrintNurseDayPage({ searchParams }: Props) {
  await enterPrintSession();
  const sp = await searchParams;
  const lang = normalizePrintLang(sp.lang);
  const date = sp.date?.trim() || todayBakuYmd();
  if (sp.bundle === "staff") {
    const docs = await buildNurseDayStaffBundle({ lang, date });
    const branding =
      docs[0]?.branding ?? (await buildNurseDayPrint({ lang, date, empty: true })).branding;
    return (
      <PrintShell
        lang={lang}
        branding={branding}
        title={printLabel(lang, "nurseDay")}
        autoPrint={sp.autoprint === "1"}
      >
        {docs.length === 0 ? (
          <p className="text-[12px]">
            {printLabel(lang, "date")}: {printDateFromYmd(date)}
          </p>
        ) : (
          docs.map((doc, index) => (
            <div key={`${doc.staffName}-${index}`} className={index > 0 ? "break-before-page pt-6" : ""}>
              <SheetTable lang={lang} doc={doc} />
            </div>
          ))
        )}
        <style>{`@media print { .break-before-page { break-before: page; padding-top: 0 !important; } }`}</style>
      </PrintShell>
    );
  }
  let practitionerId = sp.practitionerId?.trim() || null;
  if (!practitionerId && sp.mine === "1") {
    const session = await getSatelliteSession();
    const mine = session?.sub
      ? await prisma.practitioner.findFirst({
          where: { userId: session.sub },
          select: { id: true },
        })
      : null;
    practitionerId = mine?.id ?? null;
    if (!practitionerId) {
      const empty = await buildNurseDayPrint({ lang, date, empty: true });
      return (
        <PrintShell lang={lang} branding={empty.branding} title={printLabel(lang, "nurseDay")}>
          <p className="text-[12px]">{empty.titleDate}</p>
        </PrintShell>
      );
    }
  }
  const doc = await buildNurseDayPrint({
    lang,
    date,
    practitionerId,
    mine: sp.mine === "1",
    patient: sp.patient,
    procedure: sp.procedure,
  });

  return (
    <PrintShell
      lang={lang}
      branding={doc.branding}
      title={printLabel(lang, "nurseDay")}
      autoPrint={sp.autoprint === "1"}
    >
      <SheetTable lang={lang} doc={doc} />
    </PrintShell>
  );
}
