'use client';

import { MODAL_INPUT_CLASS } from '@era/satellite-kit/ui';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function ListFilterInput({ value, onChange, placeholder, className }: Props) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className ?? `${MODAL_INPUT_CLASS} max-w-xs text-[13px]`}
    />
  );
}
