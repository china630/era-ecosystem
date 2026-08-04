"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FieldSelect, ModalFooter, ModalShell } from "@era/satellite-kit/ui";
import type { PrintLang } from "@/domain/print/print-types";
import { normalizePrintLang } from "@/domain/print/print-types";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Path without query, e.g. /print/lab-order/abc */
  href: string | null;
  title?: string;
};

export function PrintLanguageDialog({ open, onClose, href, title }: Props) {
  const locale = useLocale();
  const t = useTranslations("print");
  const [lang, setLang] = useState<PrintLang>(normalizePrintLang(locale));

  useEffect(() => {
    if (open) setLang(normalizePrintLang(locale));
  }, [open, locale]);

  function submit() {
    if (!href) return;
    const url = `${href}?lang=${lang}&autoprint=1`;
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  }

  return (
    <ModalShell open={open} title={title ?? t("chooseLanguage")} onClose={onClose}>
      <FieldSelect
        label={t("chooseLanguage")}
        preset="select"
        value={lang}
        onChange={(e) => setLang(normalizePrintLang(e.target.value))}
      >
        <option value="az">Azərbaycan</option>
        <option value="ru">Русский</option>
        <option value="en">English</option>
      </FieldSelect>
      <ModalFooter
        onCancel={onClose}
        onSubmit={submit}
        submitLabel={t("print")}
        cancelLabel={t("cancel")}
      />
    </ModalShell>
  );
}
