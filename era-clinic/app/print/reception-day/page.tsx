import { PrintShell } from "@/components/print/PrintShell";
import { buildNurseDayPrint } from "@/domain/print/print-nurse-day.service";
import { printLabel } from "@/domain/print/print-labels";
import { normalizePrintLang } from "@/domain/print/print-types";
import { enterPrintSession } from "@/domain/print/print-session";
import { todayBakuYmd } from "@/lib/baku-day";

type Props = {
  searchParams: Promise<{
    lang?: string;
    autoprint?: string;
    date?: string;
    slice?: string;
    practitionerId?: string;
    procedureCode?: string;
  }>;
};

export default async function PrintReceptionDayPage({ searchParams }: Props) {
  await enterPrintSession();
  const sp = await searchParams;
  const lang = normalizePrintLang(sp.lang);
  const slice = sp.slice === "STAFF" || sp.slice === "PROCEDURE" ? sp.slice : "ALL";
  const missingSlice =
    (slice === "STAFF" && !sp.practitionerId?.trim()) ||
    (slice === "PROCEDURE" && !sp.procedureCode?.trim());
  const doc = await buildNurseDayPrint({
    lang,
    date: sp.date?.trim() || todayBakuYmd(),
    empty: missingSlice,
    practitionerId: slice === "STAFF" ? sp.practitionerId : null,
    procedureCode: slice === "PROCEDURE" ? sp.procedureCode : null,
  });
  const sliceLabel =
    slice === "STAFF"
      ? doc.staffName
      : slice === "PROCEDURE"
        ? sp.procedureCode?.trim() || printLabel(lang, "procedureName")
        : printLabel(lang, "allStaff");

  return (
    <PrintShell
      lang={lang}
      branding={doc.branding}
      title={printLabel(lang, "nurseDay")}
      autoPrint={sp.autoprint === "1"}
    >
      <p className="mb-3 text-[11px]">
        <strong>{printLabel(lang, "date")}:</strong> {doc.titleDate}
        {" · "}
        <strong>{printLabel(lang, "staff")}:</strong> {sliceLabel}
      </p>
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="border-b border-black">
            <th className="p-1 text-left">{printLabel(lang, "no")}</th>
            <th className="p-1 text-left">{printLabel(lang, "time")}</th>
            <th className="p-1 text-left">{printLabel(lang, "procedureName")}</th>
            <th className="p-1 text-left">{printLabel(lang, "patient")}</th>
            <th className="p-1 w-[34%] text-left">{printLabel(lang, "note")}</th>
          </tr>
        </thead>
        <tbody>
          {doc.rows.map((row) => (
            <tr key={row.no} className="border-b border-black/30 align-top">
              <td className="p-1">{row.no}</td>
              <td className="p-1 whitespace-nowrap">{row.time}</td>
              <td className="p-1">{row.name}</td>
              <td className="p-1">{row.patient}</td>
              <td className="p-1">{row.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PrintShell>
  );
}
