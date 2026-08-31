"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CatalogField, FieldSelect, useDebouncedValue } from "@era/satellite-kit/ui";

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
  const [query, setQuery] = useState("");
  const debouncedQ = useDebouncedValue(query, 300);
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

  useEffect(() => {
    if (!valueId) {
      setSelected(null);
      return;
    }
    const hit = items.find((i) => i.id === valueId);
    if (hit) {
      setSelected(hit);
      return;
    }
    let cancelled = false;
    void fetch(`/api/icd?id=${encodeURIComponent(valueId)}&locale=${encodeURIComponent(locale)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const row = (d.item ?? d.data?.item) as IcdPickerItem | undefined;
        if (row?.id) setSelected(row);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [valueId, items, locale]);

  const options = useMemo(() => {
    const list = [...items];
    if (selected && !list.some((i) => i.id === selected.id)) {
      list.unshift(selected);
    }
    return list.map((i) => ({
      value: i.id,
      label: i.favorite ? `★ ${i.code} — ${i.title}` : `${i.code} — ${i.title}`,
    }));
  }, [items, selected]);

  return (
    <div className="space-y-2">
      {showChapterFilter && onChapterChange && chapters.length > 0 ? (
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
      <CatalogField
        kind="SEARCHABLE"
        label={label}
        value={valueId}
        required={required}
        options={options}
        onQueryChange={setQuery}
        serverSearch
        onChange={(v) => {
          const id = String(v);
          const hit = items.find((i) => i.id === id) ?? (selected?.id === id ? selected : null);
          setSelected(hit);
          onChange(id, hit);
          if (!hit) setQuery("");
        }}
      />
    </div>
  );
}
