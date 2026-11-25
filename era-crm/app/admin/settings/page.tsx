"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  Field,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

type ConvertSideEffects = {
  createPromotion: boolean;
  promotionPercent: number;
  createBooking: boolean;
  bookingOffsetDays: number;
  createShipment: boolean;
  createPortalLink: boolean;
  createPaymentLink: boolean;
};

const EMPTY_CONVERT: ConvertSideEffects = {
  createPromotion: false,
  promotionPercent: 5,
  createBooking: false,
  bookingOffsetDays: 1,
  createShipment: false,
  createPortalLink: false,
  createPaymentLink: true,
};

export default function CrmSettingsPage() {
  const t = useTranslations("adminSettings");
  const tc = useTranslations("common");
  const [teamName, setTeamName] = useState("Field sales");
  const [voen, setVoen] = useState("");
  const [mdmResult, setMdmResult] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(teamName);
  const [convert, setConvert] = useState<ConvertSideEffects>(EMPTY_CONVERT);
  const [convertMsg, setConvertMsg] = useState("");
  const [convertBusy, setConvertBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/convert-settings");
      const json = await res.json();
      if (res.ok) setConvert({ ...EMPTY_CONVERT, ...json });
    })();
  }, []);

  async function saveConvert() {
    setConvertBusy(true);
    setConvertMsg("");
    try {
      const res = await fetch("/api/admin/convert-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(convert),
      });
      const json = await res.json();
      if (!res.ok) {
        setConvertMsg(json.error ?? tc("saveFailed"));
        return;
      }
      setConvert({ ...EMPTY_CONVERT, ...json });
      setConvertMsg(t("convertSaved"));
    } finally {
      setConvertBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/custom-fields" className={SECONDARY_BUTTON_CLASS}>
              {t("customFieldsLink")}
            </Link>
            <Link href="/leads" className={SECONDARY_BUTTON_CLASS}>
              {t("leads")}
            </Link>
          </div>
        }
      />
      <table className={`${CARD_CONTAINER_CLASS} mt-4 w-full text-left text-sm`}>
        <thead>
          <tr className="border-b border-[#D5DADF] text-[#7F8C8D]">
            <th className="p-3">{tc("field")}</th>
            <th className="p-3">{tc("value")}</th>
            <th className="p-3 text-right">{tc("actions")}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-3 font-medium">{t("teamName")}</td>
            <td className="p-3">{teamName}</td>
            <td className="p-3 text-right">
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                onClick={() => {
                  setDraft(teamName);
                  setOpen(true);
                }}
              >
                {tc("edit")}
              </button>
            </td>
          </tr>
          <tr>
            <td className="p-3 font-medium">{t("voenLookup")}</td>
            <td className="p-3">
              <Field
                label={t("voenLookup")}
                preset="voen"
                value={voen}
                onChange={(e) => setVoen(e.target.value.replace(/\D/g, "").slice(0, 10))}
                inputMode="numeric"
              />
            </td>
            <td className="p-3 text-right">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => {
                  void fetch("/api/mdm/voen-lookup", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ taxId: voen }),
                  })
                    .then((r) => r.json())
                    .then((d) =>
                      setMdmResult(
                        d.organizationId
                          ? t("orgFound", { id: String(d.organizationId).slice(0, 8) })
                          : t("notFound"),
                      ),
                    );
                }}
              >
                {t("lookup")}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      {mdmResult ? <p className="mt-2 text-xs text-[#7F8C8D]">{mdmResult}</p> : null}

      <section className={`${CARD_CONTAINER_CLASS} mt-6 space-y-3 p-4`}>
        <h2 className="text-sm font-semibold uppercase text-[#7F8C8D]">
          {t("convertTitle")}
        </h2>
        <p className="text-xs text-[#7F8C8D]">{t("convertHint")}</p>
        {(
          [
            ["createPaymentLink", "createPaymentLink"],
            ["createPortalLink", "createPortalLink"],
            ["createShipment", "createShipment"],
            ["createBooking", "createBooking"],
            ["createPromotion", "createPromotion"],
          ] as const
        ).map(([key, labelKey]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={convert[key]}
              onChange={(e) =>
                setConvert((prev) => ({ ...prev, [key]: e.target.checked }))
              }
            />
            {t(labelKey)}
          </label>
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={t("promotionPercent")}
            preset="shortText"
            inputMode="numeric"
            value={String(convert.promotionPercent)}
            onChange={(e) =>
              setConvert((prev) => ({
                ...prev,
                promotionPercent: Number(e.target.value.replace(/\D/g, "") || 0),
              }))
            }
          />
          <Field
            label={t("bookingOffsetDays")}
            preset="shortText"
            inputMode="numeric"
            value={String(convert.bookingOffsetDays)}
            onChange={(e) =>
              setConvert((prev) => ({
                ...prev,
                bookingOffsetDays: Number(e.target.value.replace(/\D/g, "") || 0),
              }))
            }
          />
        </div>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={convertBusy}
          onClick={() => void saveConvert()}
        >
          {tc("save")}
        </button>
        {convertMsg ? <p className="text-xs text-[#7F8C8D]">{convertMsg}</p> : null}
      </section>

      <ModalShell open={open} title={t("editTeam")} onClose={() => setOpen(false)}>
        <Field
          label={t("teamName")}
          preset="shortText"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <ModalFooter
          onCancel={() => setOpen(false)}
          onSubmit={() => {
            setTeamName(draft.trim() || teamName);
            setOpen(false);
          }}
          submitLabel={tc("save")}
        />
      </ModalShell>
    </div>
  );
}
