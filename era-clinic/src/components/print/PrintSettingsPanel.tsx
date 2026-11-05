"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  Field,
  FieldTextarea,
  FORM_STACK_CLASS,
  MODAL_CHECKBOX_CLASS,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXT_MUTED_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import { DEFAULT_CHECKUP_SECTIONS, type CheckupSectionConfig } from "@/domain/print/print-types";

type CpPrint = {
  active: boolean;
  logo: boolean;
  address: boolean;
  phone: boolean;
  email: boolean;
  website: boolean;
  resolved: {
    name: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    logoUrl: string;
  };
};

type PrintDraft = {
  printLogoDataUrl: string | null;
  printClinicNameEn: string;
  printClinicNameRu: string;
  printClinicNameAz: string;
  printAddressEn: string;
  printAddressRu: string;
  printAddressAz: string;
  printPhone: string;
  printEmail: string;
  printWebsite: string;
  printFooterEn: string;
  printFooterRu: string;
  printFooterAz: string;
  printSignatureLab: string;
  printSignatureDoctor: string;
  procedurePrintExtraLang: "" | "az" | "ru" | "en";
  modalitySigners: Record<string, string>;
  checkupSections: CheckupSectionConfig[];
  controlPlanePrint?: CpPrint | null;
};

function parseSignerMap(raw: unknown): Record<string, string> {
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [code, name] of Object.entries(parsed)) {
      if (typeof name === "string") out[code] = name;
    }
    return out;
  } catch {
    return {};
  }
}

const EMPTY: PrintDraft = {
  printLogoDataUrl: null,
  printClinicNameEn: "",
  printClinicNameRu: "",
  printClinicNameAz: "",
  printAddressEn: "",
  printAddressRu: "",
  printAddressAz: "",
  printPhone: "",
  printEmail: "",
  printWebsite: "",
  printFooterEn: "",
  printFooterRu: "",
  printFooterAz: "",
  printSignatureLab: "",
  printSignatureDoctor: "",
  procedurePrintExtraLang: "",
  modalitySigners: {},
  checkupSections: DEFAULT_CHECKUP_SECTIONS,
  controlPlanePrint: null,
};

export function PrintSettingsPanel({ part = "all" }: { part?: "all" | "brand" | "signers" }) {
  const t = useTranslations("adminSettings");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [data, setData] = useState<PrintDraft>(EMPTY);
  const [draft, setDraft] = useState<PrintDraft>(EMPTY);
  const [open, setOpen] = useState(false);
  const [modalities, setModalities] = useState<
    { code: string; titleEn: string; titleRu: string; titleAz: string }[]
  >([]);

  useEffect(() => {
    void fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        const row = d.data ?? d;
        const cp = (row.controlPlanePrint ?? null) as CpPrint | null;
        const next: PrintDraft = {
          printLogoDataUrl: row.printLogoDataUrl ?? null,
          printClinicNameEn: row.printClinicNameEn ?? "",
          printClinicNameRu: row.printClinicNameRu ?? "",
          printClinicNameAz: row.printClinicNameAz ?? "",
          printAddressEn: row.printAddressEn ?? "",
          printAddressRu: row.printAddressRu ?? "",
          printAddressAz: row.printAddressAz ?? "",
          printPhone: row.printPhone ?? "",
          printEmail: row.printEmail ?? "",
          printWebsite: row.printWebsite ?? "",
          printFooterEn: row.printFooterEn ?? "",
          printFooterRu: row.printFooterRu ?? "",
          printFooterAz: row.printFooterAz ?? "",
          printSignatureLab: row.printSignatureLab ?? "",
          printSignatureDoctor: row.printSignatureDoctor ?? "",
          procedurePrintExtraLang:
            row.procedurePrintExtraLang === "az" ||
            row.procedurePrintExtraLang === "ru" ||
            row.procedurePrintExtraLang === "en"
              ? row.procedurePrintExtraLang
              : "",
          modalitySigners: parseSignerMap(row.printModalitySignersJson),
          checkupSections: Array.isArray(row.checkupSections)
            ? row.checkupSections
            : row.checkupSectionsJson
              ? (JSON.parse(row.checkupSectionsJson) as CheckupSectionConfig[])
              : DEFAULT_CHECKUP_SECTIONS,
          controlPlanePrint: cp,
        };
        setData(next);
        setDraft(next);
      });
    void fetch("/api/admin/diagnostic-catalog/modalities")
      .then((r) => r.json())
      .then((body) => {
        const rows = (body.data ?? body) as {
          code?: string;
          titleEn?: string;
          titleRu?: string;
          titleAz?: string;
        }[];
        if (!Array.isArray(rows)) return;
        setModalities(
          rows
            .filter((row) => row.code)
            .map((row) => ({
              code: String(row.code),
              titleEn: row.titleEn ?? String(row.code),
              titleRu: row.titleRu ?? String(row.code),
              titleAz: row.titleAz ?? String(row.code),
            })),
        );
      })
      .catch(() => setModalities([]));
  }, []);

  const cp = draft.controlPlanePrint;

  function onLogo(file: File | null) {
    if (cp?.logo) return;
    if (!file) {
      setDraft((p) => ({ ...p, printLogoDataUrl: null }));
      return;
    }
    if (file.size > 400_000) {
      showApiError({ error: t("logoTooLarge", { defaultValue: "Logo must be under 400KB" }) });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((p) => ({ ...p, printLogoDataUrl: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    const body: Record<string, unknown> = {
      printClinicNameEn: draft.printClinicNameEn || null,
      printClinicNameRu: draft.printClinicNameRu || null,
      printClinicNameAz: draft.printClinicNameAz || null,
      printFooterEn: draft.printFooterEn || null,
      printFooterRu: draft.printFooterRu || null,
      printFooterAz: draft.printFooterAz || null,
      printSignatureLab: draft.printSignatureLab || null,
      printSignatureDoctor: draft.printSignatureDoctor || null,
      procedurePrintExtraLang: draft.procedurePrintExtraLang || null,
      printModalitySignersJson: JSON.stringify(draft.modalitySigners),
      checkupSectionsJson: JSON.stringify(draft.checkupSections),
    };
    if (!cp?.logo) body.printLogoDataUrl = draft.printLogoDataUrl;
    if (!cp?.address) {
      body.printAddressEn = draft.printAddressEn || null;
      body.printAddressRu = draft.printAddressRu || null;
      body.printAddressAz = draft.printAddressAz || null;
    }
    if (!cp?.phone) body.printPhone = draft.printPhone || null;
    if (!cp?.email) body.printEmail = draft.printEmail || null;
    if (!cp?.website) body.printWebsite = draft.printWebsite || null;

    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      showApiError({ error: tc("saveFailed") });
      return;
    }
    setData(draft);
    setOpen(false);
    showSuccess(tc("saved"));
  }

  const previewLogo =
    (cp?.logo && cp.resolved.logoUrl) || data.printLogoDataUrl || null;
  const previewPhone =
    (cp?.phone && cp.resolved.phone) || data.printPhone || "—";
  const previewAddress =
    (cp?.address && cp.resolved.address) ||
    data.printAddressEn ||
    data.printAddressAz ||
    "—";

  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">
            {part === "signers"
              ? t("chipLabs")
              : t("printBrandTitle", { defaultValue: "Print branding" })}
          </h2>
          <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
            {t("printBrandSubtitle", { defaultValue: "Logo, clinic names, contacts for printed forms" })}
          </p>
          {cp?.active ? (
            <p className={`mt-1 text-[12px] ${TEXT_MUTED_CLASS}`}>
              {t("cpPrintBanner", {
                defaultValue:
                  "Header logo/address/phone come from the Control Plane organization profile when Sync is present. Footers and signatures stay local.",
              })}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          onClick={() => {
            setDraft(data);
            setOpen(true);
          }}
        >
          {tc("edit")}
        </button>
      </div>
      {part === "signers" ? null : (
      <div className={`${CARD_CONTAINER_CLASS} space-y-2 p-4 text-[13px]`}>
        <div className="flex items-center gap-3">
          {previewLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewLogo} alt="" className="h-12 w-auto" />
          ) : (
            <span className={TEXT_MUTED_CLASS}>{t("noLogo", { defaultValue: "No logo" })}</span>
          )}
          <div>
            <p className="m-0 font-medium">
              {(cp?.active && cp.resolved.name) ||
                data.printClinicNameEn ||
                data.printClinicNameAz ||
                "—"}
            </p>
            <p className={`m-0 ${TEXT_MUTED_CLASS}`}>{previewPhone}</p>
          </div>
        </div>
        <p className={TEXT_MUTED_CLASS}>{previewAddress}</p>
      </div>
      )}

      <ModalShell
        open={open}
        title={t("printBrandTitle", { defaultValue: "Print branding" })}
        onClose={() => setOpen(false)}
        maxWidthClass="max-w-2xl"
      >
        <div className={FORM_STACK_CLASS}>
          {part !== "signers" ? (
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("procedurePrintExtraLang")}
            hint={t("procedurePrintExtraLangHint")}
            value={draft.procedurePrintExtraLang}
            onChange={(next) =>
              setDraft((prev) => ({
                ...prev,
                procedurePrintExtraLang:
                  next === "az" || next === "ru" || next === "en" ? next : "",
              }))
            }
            options={[
              { value: "", label: t("procedurePrintExtraLangOff") },
              { value: "az", label: t("procedurePrintExtraLangAz") },
              { value: "ru", label: t("procedurePrintExtraLangRu") },
              { value: "en", label: t("procedurePrintExtraLangEn") },
            ]}
            emptyLabel={t("procedurePrintExtraLangOff")}
          />
          ) : null}
          {part !== "brand"
            ? modalities.map((modality) => {
            const title =
              locale === "ru"
                ? modality.titleRu
                : locale === "az"
                  ? modality.titleAz
                  : modality.titleEn;
            return (
              <Field
                key={modality.code}
                label={t("modalitySigner", { name: title || modality.code })}
                preset="shortText"
                value={draft.modalitySigners[modality.code] ?? ""}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    modalitySigners: {
                      ...prev.modalitySigners,
                      [modality.code]: e.target.value,
                    },
                  }))
                }
              />
            );
          })
            : null}
          {part !== "signers" ? (
          <>
          {!cp?.logo ? (
            <div>
              <p className="mb-1 text-[12px] font-medium">{t("logo", { defaultValue: "Logo" })}</p>
              <input type="file" accept="image/*" onChange={(e) => onLogo(e.target.files?.[0] ?? null)} />
              {draft.printLogoDataUrl ? (
                <button type="button" className={`mt-2 ${SECONDARY_BUTTON_CLASS}`} onClick={() => onLogo(null)}>
                  {t("clearLogo", { defaultValue: "Clear logo" })}
                </button>
              ) : null}
            </div>
          ) : (
            <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
              {t("cpLogoLocked", { defaultValue: "Logo is managed on the Control Plane organization profile." })}
            </p>
          )}
          {(
            [
              ["printClinicNameEn", "Clinic name (EN)", false],
              ["printClinicNameRu", "Clinic name (RU)", false],
              ["printClinicNameAz", "Clinic name (AZ)", false],
              ["printAddressEn", "Address (EN)", Boolean(cp?.address)],
              ["printAddressRu", "Address (RU)", Boolean(cp?.address)],
              ["printAddressAz", "Address (AZ)", Boolean(cp?.address)],
              ["printPhone", "Phone", Boolean(cp?.phone)],
              ["printEmail", "Email", Boolean(cp?.email)],
              ["printWebsite", "Website", Boolean(cp?.website)],
              ["printSignatureLab", "Default lab signature", false],
              ["printSignatureDoctor", "Default doctor signature", false],
            ] as const
          )
            .filter(([, , locked]) => !locked)
            .map(([key, label]) => (
              <Field
                key={key}
                label={label}
                preset="shortText"
                value={draft[key] as string}
                onChange={(e) => setDraft((p) => ({ ...p, [key]: e.target.value }))}
              />
            ))}
          {cp?.address || cp?.phone || cp?.email || cp?.website ? (
            <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
              {t("cpContactsLocked", {
                defaultValue:
                  "Address / phone / email / website from Control Plane are read-only here.",
              })}
            </p>
          ) : null}
          <FieldTextarea
            label="Footer (EN)"
            value={draft.printFooterEn}
            onChange={(e) => setDraft((p) => ({ ...p, printFooterEn: e.target.value }))}
          />
          <FieldTextarea
            label="Footer (RU)"
            value={draft.printFooterRu}
            onChange={(e) => setDraft((p) => ({ ...p, printFooterRu: e.target.value }))}
          />
          <FieldTextarea
            label="Footer (AZ)"
            value={draft.printFooterAz}
            onChange={(e) => setDraft((p) => ({ ...p, printFooterAz: e.target.value }))}
          />
          <fieldset className="space-y-2">
            <legend className="text-[12px] font-medium">
              {t("checkupSections", { defaultValue: "Check-up sections" })}
            </legend>
            {draft.checkupSections.map((sec, idx) => (
              <label key={sec.specialty} className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  className={MODAL_CHECKBOX_CLASS}
                  checked={sec.enabled}
                  onChange={(e) => {
                    setDraft((p) => {
                      const next = [...p.checkupSections];
                      next[idx] = { ...sec, enabled: e.target.checked };
                      return { ...p, checkupSections: next };
                    });
                  }}
                />
                {sec.specialty}
              </label>
            ))}
          </fieldset>
          </>
          ) : null}
        </div>
        <ModalFooter onCancel={() => setOpen(false)} onSubmit={() => void save()} submitLabel={tc("save")} />
      </ModalShell>
    </div>
  );
}
