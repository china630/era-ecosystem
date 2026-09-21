"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CatalogField } from "@era/satellite-kit/ui";
import {
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_CLOSE_BUTTON_CLASS,
} from "../../lib/design-system";
import { Button } from "../ui/button";
import { X } from "lucide-react";

export type PrintLang = "az" | "ru" | "en";

type Props = {
  open: boolean;
  onClose: () => void;
  href: string | null;
  title?: string;
};

export function PrintLanguageDialog({ open, onClose, href, title }: Props) {
  const { t, i18n } = useTranslation();
  const [lang, setLang] = useState<PrintLang>("az");

  useEffect(() => {
    if (!open) return;
    const raw = (i18n.language ?? "az").toLowerCase();
    if (raw.startsWith("ru")) setLang("ru");
    else if (raw.startsWith("en")) setLang("en");
    else setLang("az");
  }, [open, i18n.language]);

  if (!open) return null;

  function submit() {
    if (!href) return;
    window.open(`${href}?lang=${lang}&autoprint=1`, "_blank", "noopener,noreferrer");
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-md`}>
        <header className="flex shrink-0 items-start justify-between gap-3">
          <h2 className="m-0 min-w-0 flex-1 pr-2 text-lg font-semibold text-[#34495E]">
            {title ?? t("print.chooseLanguage")}
          </h2>
          <Button
            type="button"
            variant="ghost"
            className={MODAL_CLOSE_BUTTON_CLASS}
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4 shrink-0" aria-hidden />
          </Button>
        </header>
        <div className="mt-4">
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("print.chooseLanguage")}
            value={lang}
            onChange={(v) => setLang((v as PrintLang) || "az")}
            options={[
              { value: "az", label: "Azərbaycan" },
              { value: "ru", label: "Русский" },
              { value: "en", label: "English" },
            ]}
          />
        </div>
        <div className={MODAL_FOOTER_ACTIONS_CLASS}>
          <Button
            type="button"
            variant="outline"
            className={MODAL_FOOTER_BUTTON_CLASS}
            onClick={onClose}
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            type="button"
            variant="primary"
            className={MODAL_FOOTER_BUTTON_CLASS}
            onClick={submit}
            disabled={!href}
          >
            {t("print.print")}
          </Button>
        </div>
      </div>
    </div>
  );
}
