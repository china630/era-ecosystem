"use client";

import type { ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import {
  FORM_FIELD_GROUP_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  MODAL_TEXTAREA_CLASS,
} from "./design-system";
import { fieldWidthClass, type FieldWidthPreset } from "./field-presets";

type FieldHintProps = {
  label: string;
  preset: FieldWidthPreset;
  required?: boolean;
  hint?: string;
  error?: string;
  htmlFor?: string;
  className?: string;
};

function FieldShell({
  label,
  required,
  hint,
  error,
  htmlFor,
  className,
  children,
}: Omit<FieldHintProps, "preset"> & { children: ReactNode }) {
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

export type FieldProps = FieldHintProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "className"> & {
    inputClassName?: string;
  };

export function Field({
  label,
  preset,
  required,
  hint,
  error,
  id,
  inputClassName,
  className,
  ...inputProps
}: FieldProps) {
  const inputId = id ?? (label ? undefined : inputProps.name);
  return (
    <FieldShell
      label={label}
      required={required}
      hint={hint}
      error={error}
      htmlFor={inputId}
      className={className}
    >
      <input
        id={inputId}
        className={`${MODAL_INPUT_CLASS} ${fieldWidthClass(preset)} ${inputClassName ?? ""}`.trim()}
        {...inputProps}
      />
    </FieldShell>
  );
}

export type FieldSelectProps = FieldHintProps &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> & {
    selectClassName?: string;
    children: ReactNode;
  };

export function FieldSelect({
  label,
  preset,
  required,
  hint,
  error,
  id,
  selectClassName,
  className,
  children,
  ...selectProps
}: FieldSelectProps) {
  const selectId = id ?? (label ? undefined : selectProps.name);
  return (
    <FieldShell
      label={label}
      required={required}
      hint={hint}
      error={error}
      htmlFor={selectId}
      className={className}
    >
      <select
        id={selectId}
        className={`${MODAL_INPUT_CLASS} ${fieldWidthClass(preset)} ${selectClassName ?? ""}`.trim()}
        {...selectProps}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export type FieldTextareaProps = Omit<FieldHintProps, "preset"> &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
    textareaClassName?: string;
  };

export function FieldTextarea({
  label,
  required,
  hint,
  error,
  id,
  textareaClassName,
  className,
  ...textareaProps
}: FieldTextareaProps) {
  const textareaId = id ?? (label ? undefined : textareaProps.name);
  return (
    <FieldShell
      label={label}
      required={required}
      hint={hint}
      error={error}
      htmlFor={textareaId}
      className={className}
    >
      <textarea
        id={textareaId}
        className={`${MODAL_TEXTAREA_CLASS} ${fieldWidthClass("textarea")} ${textareaClassName ?? ""}`.trim()}
        {...textareaProps}
      />
    </FieldShell>
  );
}

const ROW_COLS_CLASS: Record<2 | 3 | 4 | 6, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
  6: "grid-cols-3 sm:grid-cols-6",
};

export function FieldRow({
  cols = 2,
  className,
  children,
  "data-testid": testId = "field-row",
}: {
  cols?: 2 | 3 | 4 | 6;
  className?: string;
  children: ReactNode;
  "data-testid"?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={`grid ${ROW_COLS_CLASS[cols]} items-end gap-3 ${className ?? ""}`.trim()}
    >
      {children}
    </div>
  );
}
