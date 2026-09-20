"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  FORM_FIELD_GROUP_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
} from "./design-system";
import { Field, FieldSelect } from "./field";
import { fieldWidthClass, type FieldWidthPreset } from "./field-presets";
import {
  resolveCatalogControl,
  type CatalogFieldKind,
} from "./catalog-field-kind";

export type CatalogOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type CatalogFieldProps = {
  kind: CatalogFieldKind;
  label: string;
  value: string | string[];
  onChange: (next: string | string[]) => void;
  options: CatalogOption[];
  required?: boolean;
  hint?: string;
  error?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  /** Empty option label for selects (default "—"). Pass null to omit. */
  emptyLabel?: string | null;
  /** OPS_HOT: force chips even if options > 4 (not recommended). */
  preferChips?: boolean;
  name?: string;
  onQueryChange?: (q: string) => void;
  /** When onQueryChange is set, options are treated as server results (no local-only filter). */
  serverSearch?: boolean;
  /** Override kind-default width (e.g. select instead of selectWide in compact modals). */
  widthPreset?: FieldWidthPreset;
};

function Shell({
  label,
  required,
  hint,
  error,
  htmlFor,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`${FORM_FIELD_GROUP_CLASS} ${className ?? ""}`.trim()}>
      <label className={MODAL_FIELD_LABEL_CLASS} htmlFor={htmlFor} title={hint || undefined}>
        {label}
        {required ? <span className="text-[#E74C3C]"> *</span> : null}
        {hint ? (
          <span className="ml-1 cursor-help text-[#95A5A6]" title={hint} aria-label={hint}>
            ?
          </span>
        ) : null}
      </label>
      {children}
      {error ? <p className="text-xs text-[#E74C3C]">{error}</p> : null}
    </div>
  );
}

/**
 * Kind-driven pick-list field. Control type comes from resolveCatalogControl(kind).
 * Do not use Field shortText for catalog-shaped values — pass kind=FREE_TEXT only when free text is intentional.
 */
export function CatalogField({
  kind,
  label,
  value,
  onChange,
  options,
  required,
  hint,
  error,
  id,
  className,
  disabled,
  emptyLabel = "—",
  preferChips,
  name,
  onQueryChange,
  serverSearch,
  widthPreset: widthPresetOverride,
}: CatalogFieldProps) {
  const resolved = resolveCatalogControl(kind);
  const widthPreset = widthPresetOverride ?? resolved.widthPreset;
  const control =
    preferChips && kind === "CLOSED_SMALL" ? "radioChips" : resolved.control;
  const inputId = id ?? name;

  if (control === "text") {
    const str = Array.isArray(value) ? value[0] ?? "" : value;
    return (
      <Field
        label={label}
        preset={widthPreset}
        required={required}
        hint={hint}
        error={error}
        id={inputId}
        name={name}
        className={className}
        disabled={disabled}
        value={str}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (control === "radioChips") {
    const str = Array.isArray(value) ? value[0] ?? "" : value;
    return (
      <Shell
        label={label}
        required={required}
        hint={hint}
        error={error}
        htmlFor={inputId}
        className={className}
      >
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
          {options.map((opt) => {
            const active = str === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled || opt.disabled}
                className={`rounded border px-3 py-1.5 text-sm ${
                  active
                    ? "border-[#2C3E50] bg-[#2C3E50] text-white"
                    : "border-[#BDC3C7] bg-white text-[#2C3E50]"
                }`}
                onClick={() => onChange(opt.value)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Shell>
    );
  }

  if (control === "multi") {
    const selected = new Set(Array.isArray(value) ? value : value ? [value] : []);
    return (
      <Shell
        label={label}
        required={required}
        hint={hint}
        error={error}
        htmlFor={inputId}
        className={className}
      >
        <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded border border-[#BDC3C7] p-2">
          {options.map((opt) => {
            const checked = selected.has(opt.value);
            return (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={disabled || opt.disabled}
                  checked={checked}
                  onChange={() => {
                    const next = new Set(selected);
                    if (checked) next.delete(opt.value);
                    else next.add(opt.value);
                    onChange([...next]);
                  }}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      </Shell>
    );
  }

  if (control === "autocomplete") {
    return (
      <CatalogCombobox
        label={label}
        required={required}
        hint={hint}
        error={error}
        id={inputId}
        className={className}
        disabled={disabled}
        name={name}
        widthPreset={widthPreset}
        options={options}
        value={Array.isArray(value) ? value[0] ?? "" : value}
        onChange={(v) => onChange(v)}
        onQueryChange={onQueryChange}
        serverSearch={serverSearch ?? Boolean(onQueryChange)}
      />
    );
  }

  // select / selectWide
  const str = Array.isArray(value) ? value[0] ?? "" : value;
  const selectPreset =
    widthPresetOverride ?? (control === "selectWide" ? "selectWide" : "select");
  return (
    <FieldSelect
      label={label}
      preset={selectPreset}
      required={required}
      hint={hint}
      error={error}
      id={inputId}
      name={name}
      className={className}
      disabled={disabled}
      value={str}
      onChange={(e) => onChange(e.target.value)}
    >
      {emptyLabel !== null ? <option value="">{emptyLabel}</option> : null}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} disabled={opt.disabled}>
          {opt.label}
        </option>
      ))}
    </FieldSelect>
  );
}

function CatalogCombobox({
  label,
  required,
  hint,
  error,
  id,
  className,
  disabled,
  name,
  widthPreset,
  options,
  value,
  onChange,
  onQueryChange,
  serverSearch,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  name?: string;
  widthPreset: FieldWidthPreset;
  options: CatalogOption[];
  value: string;
  onChange: (v: string) => void;
  onQueryChange?: (q: string) => void;
  serverSearch?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  const filtered = useMemo(() => {
    if (serverSearch) return options.slice(0, 50);
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 50);
    return options
      .filter(
        (o) =>
          o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [options, query, serverSearch]);

  function updateCoords() {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 4;
    const spaceBelow = window.innerHeight - r.bottom - gap;
    const spaceAbove = r.top - gap;
    const preferUp = spaceBelow < 160 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(192, preferUp ? spaceAbove : spaceBelow);
    setCoords({
      top: preferUp ? Math.max(gap, r.top - maxHeight - gap) : r.bottom + gap,
      left: r.left,
      width: Math.max(r.width, 12 * 16),
      maxHeight: Math.max(96, maxHeight),
    });
  }

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updateCoords();
    const onReposition = () => updateCoords();
    window.addEventListener("resize", onReposition);
    // Capture scroll from modal body / nested overflow containers
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, filtered.length]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function handleQueryChange(next: string) {
    setQuery(next);
    onQueryChange?.(next);
  }

  const list =
    open && !disabled && coords && typeof document !== "undefined"
      ? createPortal(
          <ul
            className="overflow-y-auto rounded border border-[#BDC3C7] bg-white shadow-lg"
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: coords.width,
              maxHeight: coords.maxHeight,
              zIndex: 400,
            }}
            role="listbox"
          >
            {filtered.length === 0 ? (
              <li className="px-2 py-1.5 text-sm text-[#95A5A6]">No matches</li>
            ) : (
              filtered.map((opt) => (
                <li key={opt.value} role="option">
                  <button
                    type="button"
                    className="block w-full px-2 py-1.5 text-left text-sm hover:bg-[#EBEDF0]"
                    disabled={opt.disabled}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    {opt.label}
                  </button>
                </li>
              ))
            )}
          </ul>,
          document.body,
        )
      : null;

  return (
    <Shell
      label={label}
      required={required}
      hint={hint}
      error={error}
      htmlFor={id}
      className={className}
    >
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          name={name}
          disabled={disabled}
          className={`${MODAL_INPUT_CLASS} ${fieldWidthClass(widthPreset)}`.trim()}
          value={open ? query : selectedLabel}
          placeholder="…"
          autoComplete="off"
          onFocus={() => {
            setOpen(true);
            if (!serverSearch) setQuery("");
          }}
          onChange={(e) => {
            handleQueryChange(e.target.value);
            setOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 150);
          }}
        />
        {list}
      </div>
    </Shell>
  );
}
