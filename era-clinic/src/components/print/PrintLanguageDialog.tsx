"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CatalogField, ModalFooter, ModalShell } from "@era/satellite-kit/ui";
import type { PrintLang } from "@/domain/print/print-types";
import { normalizePrintLang } from "@/domain/print/print-types";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Path, optionally with a query (`?episode=`). Language is appended with `?` or `&`. */
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
    const joiner = href.includes("?") ? "&" : "?";
    const url = `${href}${joiner}lang=${encodeURIComponent(lang)}&autoprint=1`;
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  }

  return (
    <ModalShell
      open={open}
      title={title ?? t("chooseLanguage")}
      onClose={onClose}
    >
      <CatalogField
        kind="CLOSED_SMALL"
        preferChips
        label={t("chooseLanguage")}
        value={lang}
        emptyLabel={null}
        options={[
          { value: "az", label: "Azərbaycan" },
          { value: "ru", label: "Русский" },
          { value: "en", label: "English" },
        ]}
        onChange={(next) => {
          const value = Array.isArray(next) ? next[0] : next;
          setLang(normalizePrintLang(value));
        }}
      />
      <ModalFooter
        onCancel={onClose}
        onSubmit={submit}
        submitLabel={t("print")}
        cancelLabel={t("cancel")}
      />
    </ModalShell>
  );
}
