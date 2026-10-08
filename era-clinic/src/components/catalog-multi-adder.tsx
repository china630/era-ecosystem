"use client";

import { X } from "lucide-react";
import { CatalogField, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";

export function catalogNameThenCode(name: string, code: string): string {
  const title = name.trim();
  const id = code.trim();
  if (!title) return id;
  if (!id || title === id) return title;
  return `${title} (${id})`;
}

/** Kit combobox that adds a value, plus removable chips. Chips stay hidden until something is chosen. */
export function CatalogMultiAdder({
  label,
  hint,
  options,
  value,
  onChange,
  emptyLabel = "—",
  selectAllLabel,
  removeLabel,
  /** Chosen rows as a scrolling list. Chips stay the default. */
  list,
}: {
  label: string;
  hint?: string;
  options: Array<{ value: string; label: string }>;
  value: string[];
  onChange: (next: string[]) => void;
  emptyLabel?: string;
  selectAllLabel?: string;
  removeLabel: string;
  list?: boolean;
}) {
  const selected = new Set(value);
  const remaining = options.filter((opt) => !selected.has(opt.value));
  const labelOf = (id: string) => options.find((opt) => opt.value === id)?.label ?? id;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <CatalogField
            kind="SEARCHABLE"
            label={label}
            hint={hint}
            value=""
            emptyLabel={emptyLabel}
            options={remaining}
            onChange={(next) => {
              const picked = String(next ?? "");
              if (!picked || selected.has(picked)) return;
              onChange([...value, picked]);
            }}
          />
        </div>
        {selectAllLabel ? (
          <button
            type="button"
            className={`${SECONDARY_BUTTON_CLASS} mb-0.5 shrink-0`}
            onClick={() => onChange(options.map((opt) => opt.value))}
          >
            {selectAllLabel}
          </button>
        ) : null}
      </div>
      {value.length > 0 && list ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded border border-[#BDC3C7] bg-white p-1">
          {value.map((id) => (
            <li
              key={id}
              className="flex items-center justify-between gap-2 px-2 py-1 text-[13px] text-[#2C3E50]"
            >
              <span className="min-w-0 truncate">{labelOf(id)}</span>
              <button
                type="button"
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-[#C0392B]"
                aria-label={removeLabel}
                onClick={() => onChange(value.filter((row) => row !== id))}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : value.length > 0 ? (
        <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
          {value.map((id) => (
            <span
              key={id}
              className="inline-flex max-w-full items-center gap-1 rounded border border-[#BDC3C7] bg-white px-2 py-1 text-[13px] text-[#2C3E50]"
            >
              <span className="truncate">{labelOf(id)}</span>
              <button
                type="button"
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-[#C0392B]"
                aria-label={removeLabel}
                onClick={() => onChange(value.filter((row) => row !== id))}
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
