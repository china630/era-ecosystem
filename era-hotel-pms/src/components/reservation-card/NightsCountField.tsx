'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Field } from '@era/satellite-kit/ui';

/** Nights count with step buttons. Commits an integer of at least 1. */
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
  const t = useTranslations('reservationCard');
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  function commit(raw: string) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) {
      setDraft(value);
      return;
    }
    onCommit(n);
  }

  function step(delta: number) {
    const base = Number(value);
    const n = (Number.isInteger(base) && base >= 1 ? base : 1) + delta;
    if (n < 1) return;
    onCommit(n);
  }

  return (
    <div className="flex min-w-0 items-end gap-0.5">
      <Field
        label={label}
        preset="count"
        value={draft}
        disabled={disabled}
        hint={hint}
        className="min-w-0 w-full"
        inputClassName="w-full min-w-0 text-center"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      <div className="mb-0.5 flex shrink-0 flex-col">
        <button
          type="button"
          className="rounded border border-[#D5DADF] px-0.5 text-[#34495E] hover:bg-[#F4F6F7] disabled:opacity-40"
          aria-label={t('nightsUp')}
          disabled={disabled}
          onClick={() => step(1)}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="rounded border border-t-0 border-[#D5DADF] px-0.5 text-[#34495E] hover:bg-[#F4F6F7] disabled:opacity-40"
          aria-label={t('nightsDown')}
          disabled={disabled || Number(value) <= 1}
          onClick={() => step(-1)}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
