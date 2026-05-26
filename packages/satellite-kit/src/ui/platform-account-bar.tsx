"use client";

import {
  buildFinanceBillingUrl,
  buildFinanceTeamUrl,
} from "../integration/finance-deep-links";
import type { PlatformCapabilities } from "../auth/platform-session";

type Props = {
  capabilities: PlatformCapabilities;
  organizationId?: string;
  className?: string;
};

/** Read-only org context + deep links to Finance (no local RBAC proxy). */
export function PlatformAccountBar({
  capabilities,
  organizationId,
  className = "",
}: Props) {
  if (!capabilities.isPlatformSession) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-3 border-b border-[#D5DADF] pb-3 text-[12px] text-[#5D6D7E] ${className}`}
    >
      <span>
        Org: <strong className="text-[#34495E]">{organizationId ?? "—"}</strong>
        {capabilities.financeRole ? (
          <>
            {" "}
            · {capabilities.financeRole}
          </>
        ) : null}
      </span>
      {capabilities.canManageTeam ? (
        <a
          href={buildFinanceTeamUrl(organizationId)}
          className="text-[#2980B9] underline"
          target="_blank"
          rel="noreferrer"
        >
          Team (Finance)
        </a>
      ) : null}
      {capabilities.canManageBilling ? (
        <a
          href={buildFinanceBillingUrl(organizationId)}
          className="text-[#2980B9] underline"
          target="_blank"
          rel="noreferrer"
        >
          Billing
        </a>
      ) : null}
    </div>
  );
}
