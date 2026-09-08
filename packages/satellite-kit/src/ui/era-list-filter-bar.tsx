import { useState, type ReactNode } from "react";
import { CARD_CONTAINER_CLASS, SECONDARY_BUTTON_CLASS } from "./design-system";

export type EraListFilterBarProps = {
  children: ReactNode;
  /** Clears all filters. Rendered inline (same row as fields). */
  onReset?: () => void;
  resetLabel?: string;
  /** Extra controls (toggles, checkboxes) — same row as fields, before Reset. */
  actionsExtra?: ReactNode;
  /**
   * Secondary filters collapsed behind a toggle (keeps the primary row compact).
   * When set, a More/Less control appears before Reset.
   */
  more?: ReactNode;
  moreLabel?: string;
  lessLabel?: string;
  className?: string;
};

/**
 * Canonical list-screen filter panel (DESIGN.md / UI playbook).
 * Instant apply: fields update the query as they change (debounce text ~300ms
 * via `useDebouncedValue`). Reset sits on the same row as the fields — no Apply.
 */
export function EraListFilterBar({
  children,
  onReset,
  resetLabel = "Reset",
  actionsExtra,
  more,
  moreLabel = "More filters",
  lessLabel = "Less",
  className = "",
}: EraListFilterBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const hasMore = more != null;

  return (
    <div
      className={[CARD_CONTAINER_CLASS, "mb-0 p-2.5", className].filter(Boolean).join(" ")}
    >
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        {children}
        {actionsExtra}
        {hasMore ? (
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
          >
            {moreOpen ? lessLabel : moreLabel}
          </button>
        ) : null}
        {onReset ? (
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onReset}>
            {resetLabel}
          </button>
        ) : null}
      </div>
      {hasMore && moreOpen ? (
        <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2 border-t border-[#EBEDF0] pt-2">
          {more}
        </div>
      ) : null}
    </div>
  );
}
