import type { ReactNode } from "react";
import { CARD_CONTAINER_CLASS, SECONDARY_BUTTON_CLASS } from "./design-system";

export type EraListFilterBarProps = {
  children: ReactNode;
  /** Clears all filters. Rendered inline (same row as fields). */
  onReset?: () => void;
  resetLabel?: string;
  /** Extra controls (toggles, checkboxes) — same row as fields, before Reset. */
  actionsExtra?: ReactNode;
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
  className = "",
}: EraListFilterBarProps) {
  return (
    <div
      className={[CARD_CONTAINER_CLASS, "mb-3 p-3", className].filter(Boolean).join(" ")}
    >
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        {children}
        {actionsExtra}
        {onReset ? (
          <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onReset}>
            {resetLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
