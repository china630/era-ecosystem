import type { ReactNode } from "react";
import { headers } from "next/headers";
import {
  ERA_PATHNAME_HEADER,
  isBarePublicWebPath,
} from "../auth/middleware-helpers";
import { PlatformSessionBarServer } from "./platform-session-bar-server";

type Props = {
  children: ReactNode;
  /** Extra paths rendered without app chrome (e.g. orchestrator-only routes). */
  barePublicPrefixes?: string[];
  /** Max width class for authenticated shell (default: full viewport). */
  shellClassName?: string;
};

/**
 * Conditional app chrome — public auth/marketing pages render full-bleed
 * (Finance login reference); authenticated routes get session bar + full-width ops shell.
 */
export async function SatelliteRootChrome({
  children,
  barePublicPrefixes = [],
  shellClassName = "min-h-screen w-full min-w-0",
}: Props) {
  const pathname = (await headers()).get(ERA_PATHNAME_HEADER) ?? "";
  if (isBarePublicWebPath(pathname, barePublicPrefixes)) {
    return <>{children}</>;
  }

  return (
    <div className={shellClassName}>
      <PlatformSessionBarServer />
      {children}
    </div>
  );
}
