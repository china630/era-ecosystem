"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

export type GuestAppPreviewState = {
  enabled: boolean;
  displayName: string;
  primaryColor: string;
  logoUrl: string;
  locale: string;
  deskPhone: string;
  doctorOnDutyPhone: string;
  postStayMessage: string;
  catalogText: string;
  offersText: string;
  leadAlertMinutes: string;
};

type Phase = "before" | "in_house" | "after";
type TabId = "today" | "trip" | "care" | "hotel";

const NEUTRAL = "#1F6F5B";

function parseStringList(raw: string): string[] {
  try {
    const v = JSON.parse(raw || "[]") as unknown;
    if (!Array.isArray(v)) return [];
    return v.map(String).filter(Boolean);
  } catch {
    return [];
  }
}

export function GuestAppPhonePreview(props: GuestAppPreviewState) {
  const t = useTranslations("guestAppPreview");
  const [phase, setPhase] = useState<Phase>("before");
  const [tab, setTab] = useState<TabId>("today");
  const [bell, setBell] = useState(false);

  const color =
    /^#[0-9A-Fa-f]{6}$/.test(props.primaryColor.trim())
      ? props.primaryColor.trim()
      : NEUTRAL;
  const title = props.enabled
    ? props.displayName.trim() || t("brandMissing")
    : t("disabled");
  const catalog = useMemo(() => parseStringList(props.catalogText), [props.catalogText]);
  const offers = useMemo(() => parseStringList(props.offersText), [props.offersText]);

  const todayRows: Record<Phase, string[]> = {
    before: [t("rowBooking"), t("rowTransfer"), t("rowQuestionnaire")],
    in_house: [t("rowRoom"), t("rowProcedure"), t("rowOrders")],
    after: [t("rowCourse"), t("rowOffers")],
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="w-full text-center text-xs text-[#7F8C8D]">{t("hint")}</p>
      <div
        className="relative w-[280px] overflow-hidden rounded-[28px] border-[10px] border-[#1a1a1a] bg-[#F7F4EF] shadow-lg"
        style={{ height: 520 }}
      >
        <div className="absolute left-1/2 top-0 z-10 h-5 w-28 -translate-x-1/2 rounded-b-xl bg-[#1a1a1a]" />
        <div className="flex h-full flex-col pt-6">
          <div className="px-3 pb-2 pt-1" style={{ backgroundColor: props.enabled ? color : "#95A5A6" }}>
            <div className="flex items-center gap-2">
              {props.enabled && props.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={props.logoUrl} alt="" className="h-7 w-7 rounded bg-white object-contain" />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{title}</p>
                {props.enabled && props.deskPhone ? (
                  <p className="truncate text-[10px] text-white/90">{props.deskPhone}</p>
                ) : null}
              </div>
              <button
                type="button"
                className="text-[10px] text-white underline"
                onClick={() => setBell((v) => !v)}
              >
                {t("bell")}
              </button>
            </div>
          </div>

          {!props.enabled ? (
            <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-[#7F8C8D]">
              {t("disabledBody")}
            </div>
          ) : (
            <>
              <div className="flex justify-around border-b border-[#E8EEF2] py-1.5 text-[10px]">
                {(["today", "trip", "care", "hotel"] as TabId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={tab === id ? "font-bold text-[#2C3E50]" : "text-[#7F8C8D]"}
                    onClick={() => {
                      setTab(id);
                      setBell(false);
                    }}
                  >
                    {t(`tab_${id}`)}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-3 text-[11px] text-[#2C3E50]">
                {bell ? (
                  <p>{t("bellEmpty")}</p>
                ) : null}

                {!bell && tab === "today" ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {(["before", "in_house", "after"] as Phase[]).map((p) => (
                        <button
                          key={p}
                          type="button"
                          className={`rounded px-1.5 py-0.5 ${
                            phase === p ? "bg-[#2C3E50] text-white" : "bg-[#E8EEF2]"
                          }`}
                          onClick={() => setPhase(p)}
                        >
                          {t(`phase_${p}`)}
                        </button>
                      ))}
                    </div>
                    {todayRows[phase].map((row) => (
                      <p key={row} className="border-b border-[#E8EEF2] py-1">
                        {row} — <span className="text-[#7F8C8D]">{t("notYet")}</span>
                      </p>
                    ))}
                    {phase === "after" && props.postStayMessage ? (
                      <p className="mt-2 rounded bg-white p-2 text-[#34495E]">{props.postStayMessage}</p>
                    ) : null}
                    {phase === "after" && offers.length > 0
                      ? offers.map((o) => (
                          <p key={o} className="text-[#34495E]">
                            {o}
                          </p>
                        ))
                      : null}
                    {(props.deskPhone || props.doctorOnDutyPhone) && (
                      <div className="mt-2 rounded border border-[#E8EEF2] bg-white p-2">
                        <p className="font-medium">{t("emergency")}</p>
                        {props.deskPhone ? <p>{t("desk")}: {props.deskPhone}</p> : null}
                        {props.doctorOnDutyPhone ? (
                          <p>{t("doctor")}: {props.doctorOnDutyPhone}</p>
                        ) : null}
                      </div>
                    )}
                    <p className="text-[10px] text-[#7F8C8D]">
                      {t("leadAlert")}: {props.leadAlertMinutes || "10"} {t("minutes")}
                    </p>
                  </div>
                ) : null}

                {!bell && tab === "trip" ? <p>{t("tripEmpty")}</p> : null}
                {!bell && tab === "care" ? <p>{t("careEmpty")}</p> : null}
                {!bell && tab === "hotel" ? (
                  <div className="space-y-1">
                    {catalog.length === 0 ? (
                      <p>{t("hotelEmpty")}</p>
                    ) : (
                      catalog.map((c) => <p key={c}>{c}</p>)
                    )}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
      <p className="text-[10px] text-[#95A5A6]">{t("liveNote")}</p>
    </div>
  );
}
