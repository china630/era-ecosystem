import type { EraOpsContentProps } from "./era-ops-types";
import { APP_MAIN_CONTENT_PADDED_CLASS } from "./design-system";

/**
 * Satellite / ops main content region under `EraAppShellLayout` (fixed header).
 * Padding comes from `APP_MAIN_CONTENT_PADDED_CLASS` — same token as orch + finance.
 * Flex column + min-h-0 so fill list shells (`LIST_PAGE_SHELL_CLASS`) can own the height.
 */
export function EraOpsContent({
  children,
  className = "",
  padded = true,
}: EraOpsContentProps) {
  return (
    <main
      className={[
        "app-shell-main flex min-h-0 min-w-0 flex-1 flex-col overflow-auto",
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
