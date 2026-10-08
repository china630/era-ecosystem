'use client';

import { useEffect, useRef, useState } from 'react';
import { Field } from '@era/satellite-kit/ui';

/** Nights count. Native number spinner sits inside the field. Minimum 1. */
export function NightsCountField({
  label,
  value,
  disabled,
  hint,
  onCommit,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  hint?: string;
  onCommit: (nights: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  function commit(raw: string) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) {
      setDraft(value);
      return;
    }
    onCommit(n);
  }

  return (
    <Field
      label={label}
      preset="count"
      type="number"
      min={1}
      step={1}
      inputMode="numeric"
      value={draft}
      disabled={disabled}
      hint={hint}
      className="min-w-0 w-full"
      inputClassName="!w-full min-w-0"
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = Number(e.target.value);
        if (Number.isInteger(n) && n >= 1) onCommit(n);
      }}
      onBlur={() => {
        focused.current = false;
        commit(draft);
      }}
    />
  );
}
