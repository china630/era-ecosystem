import type { EraOpsContentProps } from "./era-ops-types";

export function EraOpsContent({
  children,
  className = "",
  padded = true,
}: EraOpsContentProps) {
  return (
    <main
      className={[
        "min-h-0 min-w-0 flex-1 overflow-auto",
        padded ? "px-4 py-6 lg:px-8" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </main>
  );
}
