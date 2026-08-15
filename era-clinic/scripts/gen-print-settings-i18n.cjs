const fs = require("fs");
const path = require("path");

// --- PrintSettingsPanel component ---
const panel = `"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  Field,
  FieldTextarea,
  FORM_STACK_CLASS,
  MODAL_CHECKBOX_CLASS,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TEXT_MUTED_CLASS,
} from "@era/satellite-kit/ui";
import { DEFAULT_CHECKUP_SECTIONS, type CheckupSectionConfig } from "@/domain/print/print-types";

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
  checkupSections: CheckupSectionConfig[];
};

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
  checkupSections: DEFAULT_CHECKUP_SECTIONS,
};

export function PrintSettingsPanel() {
  const t = useTranslations("adminSettings");
  const tc = useTranslations("common");
  const [data, setData] = useState<PrintDraft>(EMPTY);
  const [draft, setDraft] = useState<PrintDraft>(EMPTY);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        const row = d.data ?? d;
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
          checkupSections: Array.isArray(row.checkupSections)
            ? row.checkupSections
            : row.checkupSectionsJson
              ? (JSON.parse(row.checkupSectionsJson) as CheckupSectionConfig[])
              : DEFAULT_CHECKUP_SECTIONS,
        };
        setData(next);
        setDraft(next);
      });
  }, []);

  function onLogo(file: File | null) {
    if (!file) {
      setDraft((p) => ({ ...p, printLogoDataUrl: null }));
      return;
    }
    if (file.size > 400_000) {
      setMsg(t("logoTooLarge", { defaultValue: "Logo must be under 400KB" }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((p) => ({ ...p, printLogoDataUrl: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        printLogoDataUrl: draft.printLogoDataUrl,
        printClinicNameEn: draft.printClinicNameEn || null,
        printClinicNameRu: draft.printClinicNameRu || null,
        printClinicNameAz: draft.printClinicNameAz || null,
        printAddressEn: draft.printAddressEn || null,
        printAddressRu: draft.printAddressRu || null,
        printAddressAz: draft.printAddressAz || null,
        printPhone: draft.printPhone || null,
        printEmail: draft.printEmail || null,
        printWebsite: draft.printWebsite || null,
        printFooterEn: draft.printFooterEn || null,
        printFooterRu: draft.printFooterRu || null,
        printFooterAz: draft.printFooterAz || null,
        printSignatureLab: draft.printSignatureLab || null,
        printSignatureDoctor: draft.printSignatureDoctor || null,
        checkupSectionsJson: JSON.stringify(draft.checkupSections),
      }),
    });
    if (!res.ok) {
      setMsg(tc("saveFailed"));
      return;
    }
    setData(draft);
    setOpen(false);
    setMsg(tc("saved"));
  }

  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">{t("printBrandTitle", { defaultValue: "Print branding" })}</h2>
          <p className={\`text-[12px] \${TEXT_MUTED_CLASS}\`}>
            {t("printBrandSubtitle", { defaultValue: "Logo, clinic names, contacts for printed forms" })}
          </p>
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
      {msg ? <p className="mb-2 text-[13px]">{msg}</p> : null}
      <div className={\`\${CARD_CONTAINER_CLASS} space-y-2 p-4 text-[13px]\`}>
        <div className="flex items-center gap-3">
          {data.printLogoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.printLogoDataUrl} alt="" className="h-12 w-auto" />
          ) : (
            <span className={TEXT_MUTED_CLASS}>{t("noLogo", { defaultValue: "No logo" })}</span>
          )}
          <div>
            <p className="m-0 font-medium">
              {data.printClinicNameEn || data.printClinicNameAz || "—"}
            </p>
            <p className={\`m-0 \${TEXT_MUTED_CLASS}\`}>{data.printPhone || "—"}</p>
          </div>
        </div>
        <p className={TEXT_MUTED_CLASS}>{data.printAddressEn || data.printAddressAz || "—"}</p>
      </div>

      <ModalShell
        open={open}
        title={t("printBrandTitle", { defaultValue: "Print branding" })}
        onClose={() => setOpen(false)}
        maxWidthClass="max-w-2xl"
      >
        <div className={FORM_STACK_CLASS}>
          <div>
            <p className="mb-1 text-[12px] font-medium">{t("logo", { defaultValue: "Logo" })}</p>
            <input type="file" accept="image/*" onChange={(e) => onLogo(e.target.files?.[0] ?? null)} />
            {draft.printLogoDataUrl ? (
              <button type="button" className={\`mt-2 \${SECONDARY_BUTTON_CLASS}\`} onClick={() => onLogo(null)}>
                {t("clearLogo", { defaultValue: "Clear logo" })}
              </button>
            ) : null}
          </div>
          {(
            [
              ["printClinicNameEn", "Clinic name (EN)"],
              ["printClinicNameRu", "Clinic name (RU)"],
              ["printClinicNameAz", "Clinic name (AZ)"],
              ["printAddressEn", "Address (EN)"],
              ["printAddressRu", "Address (RU)"],
              ["printAddressAz", "Address (AZ)"],
              ["printPhone", "Phone"],
              ["printEmail", "Email"],
              ["printWebsite", "Website"],
              ["printSignatureLab", "Default lab signature"],
              ["printSignatureDoctor", "Default doctor signature"],
            ] as const
          ).map(([key, label]) => (
            <Field
              key={key}
              label={label}
              preset="shortText"
              value={draft[key] as string}
              onChange={(e) => setDraft((p) => ({ ...p, [key]: e.target.value }))}
            />
          ))}
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
        </div>
        <ModalFooter onCancel={() => setOpen(false)} onSubmit={() => void save()} submitLabel={tc("save")} />
      </ModalShell>
    </div>
  );
}
`;

fs.writeFileSync(
  path.join("era-clinic/src/components/print/PrintSettingsPanel.tsx"),
  panel.replace(/\r\n/g, "\n"),
  "utf8",
);
console.log("wrote PrintSettingsPanel");

// patch settings page to include panel
const settingsPage = "era-clinic/app/admin/settings/page.tsx";
let sp = fs.readFileSync(settingsPage, "utf8");
if (!sp.includes("PrintSettingsPanel")) {
  sp = sp.replace(
    '} from "@era/satellite-kit/ui";',
    `} from "@era/satellite-kit/ui";
import { PrintSettingsPanel } from "@/components/print/PrintSettingsPanel";`,
  );
  sp = sp.replace(
    "      </ModalShell>\n    </div>\n  );\n}",
    `      </ModalShell>
      <PrintSettingsPanel />
    </div>
  );
}`,
  );
  fs.writeFileSync(settingsPage, sp, "utf8");
  console.log("settings page patched");
} else {
  console.log("settings page already has panel");
}

// i18n merge
function mergePrintNs(file, printObj, adminExtra, patientExtra, labExtra) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  j.print = { ...(j.print || {}), ...printObj };
  j.adminSettings = { ...(j.adminSettings || {}), ...adminExtra };
  j.patientCard = { ...(j.patientCard || {}), ...patientExtra };
  j.labOrdersDetail = { ...(j.labOrdersDetail || {}), ...labExtra };
  fs.writeFileSync(file, JSON.stringify(j, null, 2) + "\n", "utf8");
  console.log("i18n", file);
}

mergePrintNs(
  "era-clinic/messages/en.json",
  {
    chooseLanguage: "Print language",
    print: "Print",
    cancel: "Cancel",
  },
  {
    printBrandTitle: "Print branding",
    printBrandSubtitle: "Logo, clinic names, contacts for printed forms",
    noLogo: "No logo",
    logo: "Logo",
    clearLogo: "Clear logo",
    logoTooLarge: "Logo must be under 400KB",
    checkupSections: "Check-up sections",
  },
  {
    printCheckup: "Print check-up",
    printProcedures: "Print schedule",
    print: "Print",
  },
  {
    printButton: "Print",
    printComingSoon: "Printing is coming soon.",
  },
);

mergePrintNs(
  "era-clinic/messages/ru.json",
  {
    chooseLanguage: "Язык печати",
    print: "Печать",
    cancel: "Отмена",
  },
  {
    printBrandTitle: "Брендинг печати",
    printBrandSubtitle: "Логотип, названия клиники, контакты для бланков",
    noLogo: "Нет логотипа",
    logo: "Логотип",
    clearLogo: "Убрать логотип",
    logoTooLarge: "Логотип должен быть меньше 400KB",
    checkupSections: "Секции чек-апа",
  },
  {
    printCheckup: "Печать чек-апа",
    printProcedures: "Печать графика",
    print: "Печать",
  },
  {
    printButton: "Печать",
    printComingSoon: "Печать скоро будет доступна.",
  },
);

mergePrintNs(
  "era-clinic/messages/az.json",
  {
    chooseLanguage: "Çap dili",
    print: "Çap",
    cancel: "Ləğv",
  },
  {
    printBrandTitle: "Çap brendinqi",
    printBrandSubtitle: "Loqo, klinika adları, əlaqə məlumatı",
    noLogo: "Loqo yoxdur",
    logo: "Loqo",
    clearLogo: "Loqonu sil",
    logoTooLarge: "Loqo 400KB-dan kiçik olmalıdır",
    checkupSections: "Check-up bölmələri",
  },
  {
    printCheckup: "Check-up çapı",
    printProcedures: "Qrafik çapı",
    print: "Çap",
  },
  {
    printButton: "Çap",
    printComingSoon: "Çap tezliklə əlçatan olacaq.",
  },
);

console.log("settings+i18n done");
