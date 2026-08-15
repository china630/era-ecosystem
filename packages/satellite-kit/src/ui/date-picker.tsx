"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { Calendar } from "lucide-react";
import {
  FORM_FIELD_GROUP_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
} from "./design-system";
import { fieldWidthClass, type FieldWidthPreset } from "./field-presets";

/** Convert ISO `YYYY-MM-DD` → display `DD.MM.YYYY`. */
export function isoDateToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return "";
  return `${m[3]}.${m[2]}.${m[1]}`;
}

/** Parse `DD.MM.YYYY` or `YYYY-MM-DD` → ISO `YYYY-MM-DD`, or null if invalid. */
export function parseDisplayDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return null;
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  const dmy = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s);
  if (!dmy) return null;
  const dd = dmy[1].padStart(2, "0");
  const mm = dmy[2].padStart(2, "0");
  const yyyy = dmy[3];
  const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getUTCFullYear() !== Number(yyyy) || d.getUTCMonth() + 1 !== Number(mm) || d.getUTCDate() !== Number(dd)) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

export type DatePickerProps = {
  label: string;
  /** ISO date `YYYY-MM-DD` (empty string when unset). */
  value: string;
  onChange: (isoDate: string) => void;
  /** i18n placeholder, e.g. `gg.aa.iiii` / `дд.мм.гггг` / `dd.mm.yyyy`. */
  placeholder: string;
  preset?: FieldWidthPreset;
  /**
   * Fill the parent grid cell (ignore fixed date min-width).
   * Use inside narrow FieldRow / modal side panels.
   */
  fluid?: boolean;
  required?: boolean;
  hint?: string;
  error?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  openCalendarLabel?: string;
};

/**
 * Canonical date field for ERA ops UIs.
 * Do not use native `<input type="date">` alone — Chromium lacks `az` locale
 * and falls back to Russian placeholder glyphs. Value stays ISO; display is DD.MM.YYYY.
 */
export function DatePicker({
  label,
  value,
  onChange,
  placeholder,
  preset = "date",
  fluid = false,
  required,
  hint,
  error,
  disabled,
  id,
  className,
  openCalendarLabel = "Open calendar",
}: DatePickerProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const nativeRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => (value ? isoDateToDisplay(value) : ""));
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setText(value ? isoDateToDisplay(value) : "");
    setLocalError(null);
  }, [value]);

  function commitText(raw: string) {
    const parsed = parseDisplayDate(raw);
    if (parsed === null) {
      setLocalError("invalid");
      return;
    }
    setLocalError(null);
    setText(parsed ? isoDateToDisplay(parsed) : "");
    onChange(parsed);
  }

  function onTextChange(e: ChangeEvent<HTMLInputElement>) {
    setText(e.target.value);
    setLocalError(null);
  }

  function onNativeChange(e: ChangeEvent<HTMLInputElement>) {
    const iso = e.target.value;
    setLocalError(null);
    setText(iso ? isoDateToDisplay(iso) : "");
    onChange(iso);
  }

  const showError = error || (localError ? "invalid" : null);
  const widthClass = fluid ? "w-full min-w-0 max-w-full" : fieldWidthClass(preset);

  return (
    <div className={`${FORM_FIELD_GROUP_CLASS} ${className ?? ""}`.trim()}>
      <label className={MODAL_FIELD_LABEL_CLASS} htmlFor={inputId} title={hint || undefined}>
        {label}
        {required ? <span className="text-[#E74C3C]"> *</span> : null}
        {hint ? (
          <span className="ml-1 cursor-help text-[#95A5A6]" title={hint} aria-label={hint}>
            ?
          </span>
        ) : null}
      </label>
      <div className={`relative ${widthClass}`}>
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="bday"
          disabled={disabled}
          placeholder={placeholder}
          value={text}
          onChange={onTextChange}
          onBlur={() => commitText(text)}
          className={`${MODAL_INPUT_CLASS} w-full pr-9`}
          aria-invalid={Boolean(showError)}
        />
        <button
          type="button"
          disabled={disabled}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-[#7F8C8D] hover:text-[#34495E] disabled:opacity-50"
          aria-label={openCalendarLabel}
          onClick={() => nativeRef.current?.showPicker?.() ?? nativeRef.current?.click()}
        >
          <Calendar className="h-4 w-4" aria-hidden />
        </button>
        <input
          ref={nativeRef}
          type="date"
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          value={value || ""}
          onChange={onNativeChange}
          disabled={disabled}
        />
      </div>
      {showError && showError !== "invalid" ? (
        <p className="text-xs text-[#E74C3C]">{showError}</p>
      ) : null}
    </div>
  );
}
