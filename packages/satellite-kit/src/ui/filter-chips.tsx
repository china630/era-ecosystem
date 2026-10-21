"use client";

import { CHIP_ACTIVE_CLASS, CHIP_CLASS, CHIP_GROUP_CLASS } from "./design-system";

export type FilterChipItem = {
  id: string;
  label: string;
  /** When true, the chip is omitted unless its id is always visible. */
  hidden?: boolean;
  testId?: string;
};

/**
 * One filter tray for satellite lists. Empty chips stay hidden.
 * `alwaysVisibleIds` keeps the "all" chip even when every other chip is empty.
 */
export function FilterChips({
  items,
  value,
  onChange,
  alwaysVisibleIds = [],
  ariaLabel,
}: {
  items: FilterChipItem[];
  value: string;
  onChange: (id: string) => void;
  alwaysVisibleIds?: string[];
  ariaLabel?: string;
}) {
  const pinned = new Set(alwaysVisibleIds);
  const visible = items.filter((item) => pinned.has(item.id) || !item.hidden);
  if (visible.length === 0) return null;
  return (
    <div className={CHIP_GROUP_CLASS} role="tablist" aria-label={ariaLabel}>
      {visible.map((item) => {
        const selected = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            data-testid={item.testId}
            className={selected ? CHIP_ACTIVE_CLASS : CHIP_CLASS}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
