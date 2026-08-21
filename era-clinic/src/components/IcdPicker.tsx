"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CatalogField, Field, FieldSelect, useDebouncedValue } from "@era/satellite-kit/ui";

export type IcdPickerItem = {
  id: string;
  code: string;
  title: string;
  favorite?: boolean;
};

type Props = {
  label: string;
  valueId: string;
  onChange: (id: string, item: IcdPickerItem | null) => void;
  chapter?: string;
  onChapterChange?: (chapter: string) => void;
  required?: boolean;
  showChapterFilter?: boolean;
};

export function IcdPicker({
  label,
  valueId,
  onChange,
  chapter,
  onChapterChange,
  required,
  showChapterFilter,
}: Props) {
  const locale = useLocale();
  const t = useTranslations("icd");
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);
  const [items, setItems] = useState<IcdPickerItem[]>([]);
  const [selected, setSelected] = useState<IcdPickerItem | null>(null);
  const [chapters, setChapters] = useState<Array<{ code: string; title: string }>>([]);

  useEffect(() => {
    if (!showChapterFilter) return;
    let cancelled = false;
    void fetch(`/api/icd?chapters=1&locale=${encodeURIComponent(locale)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setChapters(d.chapters ?? d.data?.chapters ?? []);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [locale, showChapterFilter]);

  useEffect(() => {
    const params = new URLSearchParams({
      q: debouncedQ,
      locale,
      take: "20",
    });
    if (chapter) params.set("chapter", chapter);
    let cancelled = false;
    void fetch(`/api/icd?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const rows = (d.items ?? d.data?.items ?? []) as IcdPickerItem[];
        setItems(rows);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [debouncedQ, locale, chapter]);

  const options = useMemo(() => {
    const list = [...items];
    if (selected && !list.some((i) => i.id === selected.id)) {
      list.unshift(selected);
    }
    return list.map((i) => ({
      value: i.id,
      label: i.favorite ? `★ ${i.title}` : i.title,
    }));
  }, [items, selected]);

  return (
    <div className="space-y-2">
      {showChapterFilter && onChapterChange ? (
        <FieldSelect
          label={t("chapter")}
          preset="selectWide"
          value={chapter ?? ""}
          onChange={(e) => onChapterChange(e.target.value)}
        >
          <option value="">{t("allChapters")}</option>
          {chapters.map((c) => (
            <option key={c.code} value={c.code}>
              {c.title}
            </option>
          ))}
        </FieldSelect>
      ) : null}
      <Field
        label={t("searchPlaceholder")}
        preset="shortText"
        type="search"
        placeholder={t("searchPlaceholder")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <CatalogField
        kind="SEARCHABLE"
        label={label}
        value={valueId}
        required={required}
        options={options}
        onChange={(v) => {
          const id = String(v);
          const hit = items.find((i) => i.id === id) ?? (selected?.id === id ? selected : null);
          setSelected(hit);
          onChange(id, hit);
        }}
      />
    </div>
  );
}
