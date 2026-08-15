import type { EraOpsContentProps } from "./era-ops-types";
import { APP_MAIN_CONTENT_PADDED_CLASS } from "./design-system";

/**
 * Satellite / ops main content region under `EraAppShellLayout` (fixed header).
 * Padding comes from `APP_MAIN_CONTENT_PADDED_CLASS` — same token as orch + finance.
 */
export function EraOpsContent({
  children,
  className = "",
  padded = true,
}: EraOpsContentProps) {
  return (
    <main
      className={[
        "app-shell-main min-h-0 min-w-0 flex-1 overflow-auto",
        padded ? APP_MAIN_CONTENT_PADDED_CLASS : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </main>
  );
}
