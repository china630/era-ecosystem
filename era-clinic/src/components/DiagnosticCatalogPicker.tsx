"use client";

import { useLocale } from "next-intl";
import {
  MODAL_INPUT_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import type { DiagnosticCatalogItem, L10n } from "@/domain/catalog/diagnostic-catalog-shared";
import { itemMatchesFavorites, pickL10n } from "@/domain/catalog/diagnostic-catalog-shared";

type Props = {
  items: DiagnosticCatalogItem[];
  selected: string[];
  onChange: (codes: string[]) => void;
  favoriteKeys?: string[];
  favoritesMode?: "first" | "only";
  search: string;
  onSearchChange: (q: string) => void;
  modalityFilter: string;
  onModalityFilterChange: (m: string) => void;
  modalities: Array<{ code: string; title: L10n }>;
  multi?: boolean;
  labels: {
    search: string;
    allModalities: string;
    favoriteBadge: string;
    empty: string;
    favoritesOnlyHint: string;
  };
};

export function DiagnosticCatalogPicker({
  items,
  selected,
  onChange,
  favoriteKeys = [],
  favoritesMode = "first",
  search,
  onSearchChange,
  modalityFilter,
  onModalityFilterChange,
  modalities,
  multi = true,
  labels,
}: Props) {
  const locale = useLocale();

  function toggle(code: string) {
    if (!multi) {
      onChange([code]);
      return;
    }
    if (selected.includes(code)) onChange(selected.filter((c) => c !== code));
    else onChange([...selected, code]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          className={`${MODAL_INPUT_CLASS} min-w-[12rem] flex-1`}
          placeholder={labels.search}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <select
          className={MODAL_INPUT_CLASS}
          value={modalityFilter}
          onChange={(e) => onModalityFilterChange(e.target.value)}
        >
          <option value="">{labels.allModalities}</option>
          {modalities.map((m) => (
            <option key={m.code} value={m.code}>
              {pickL10n(m.title, locale)}
            </option>
          ))}
        </select>
      </div>
      {favoritesMode === "only" && favoriteKeys.length > 0 && (
        <p className="text-[12px] text-[#7F8C8D]">{labels.favoritesOnlyHint}</p>
      )}
      {items.length === 0 ? (
        <p className="text-[13px] text-[#7F8C8D]">{labels.empty}</p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto rounded border p-2">
          {items.map((item) => {
            const fav = itemMatchesFavorites(item, favoriteKeys);
            const isOn = selected.includes(item.code);
            return (
              <li key={item.code}>
                <button
                  type="button"
                  className={`flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-[13px] ${
                    isOn ? "bg-blue-50 text-[#2980B9]" : "hover:bg-slate-50"
                  }`}
                  onClick={() => toggle(item.code)}
                >
                  <input type="checkbox" readOnly checked={isOn} className="mt-0.5" />
                  <span className="flex-1">
                    <span className="font-medium">{pickL10n(item.title, locale)}</span>
                    <span className="block text-[11px] text-[#7F8C8D]">
                      {item.code} · {item.modality}
                      {item.category ? ` / ${item.category}` : ""}
                    </span>
                  </span>
                  {fav && (
                    <span className={`${SECONDARY_BUTTON_CLASS} !px-1.5 !py-0 text-[10px]`}>
                      {labels.favoriteBadge}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
