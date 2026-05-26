"use client";

import Link from "next/link";
import { CARD_CONTAINER_CLASS } from "@era/satellite-kit/ui";
import {
  FINANCE_TILE,
  hasIndustryModuleAccess,
  INDUSTRY_NAV_ITEMS,
  type IndustryModuleKey,
} from "@era/satellite-kit";
import { useEarlyAccess } from "../components/early-access/early-access-context";
import { ShellHeader } from "../components/shell-header";
import { buildFinanceHandoffUrl, getOrchAccessToken } from "../lib/open-finance";
import { useRequireAuth } from "../lib/use-require-auth";
import { useSubscription } from "../lib/subscription-context";

function ModuleTile({
  item,
  entitled,
}: {
  item: (typeof INDUSTRY_NAV_ITEMS)[number];
  entitled: boolean;
}) {
  const { open: openEarlyAccess } = useEarlyAccess();

  if (entitled) {
    return (
      <Link
        href={item.href}
        className={`${CARD_CONTAINER_CLASS} block p-4 transition hover:border-[#2980B9]/40`}
      >
        <strong className="text-[#34495E]">{item.title}</strong>
        <p className="mt-1 text-xs text-[#7F8C8D]">{item.description}</p>
        <p className="mt-2 text-xs font-medium text-[#2980B9]">Open →</p>
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={`${CARD_CONTAINER_CLASS} w-full p-4 text-left opacity-80 transition hover:border-[#2980B9]/40`}
      onClick={() => openEarlyAccess(item.key as IndustryModuleKey)}
    >
      <strong className="text-[#34495E]">{item.title}</strong>
      <p className="mt-1 text-xs text-[#7F8C8D]">{item.description}</p>
      <p className="mt-2 text-xs font-medium text-amber-700">Join waitlist</p>
    </button>
  );
}

export default function HomePage() {
  const { ready } = useRequireAuth();
  const { snapshot, loading } = useSubscription();

  if (!ready) {
    return <p className="text-sm text-[#7F8C8D]">Loading…</p>;
  }

  function openFinance() {
    const token = getOrchAccessToken();
    if (!token) return;
    void buildFinanceHandoffUrl(token).then((url) => {
      if (url) window.location.href = url;
    });
  }

  return (
    <>
      <ShellHeader />
      <h1 className="text-xl font-semibold text-[#34495E]">ERA 365 — modules</h1>
      <p className="mt-1 text-sm text-[#7F8C8D]">
        Control plane entry. Open entitled modules below.
      </p>
      {loading ? (
        <p className="mt-4 text-sm text-[#7F8C8D]">Loading entitlements…</p>
      ) : null}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {INDUSTRY_NAV_ITEMS.map((item) => (
          <ModuleTile
            key={item.key}
            item={item}
            entitled={hasIndustryModuleAccess(snapshot, item.key)}
          />
        ))}
        <button
          type="button"
          onClick={openFinance}
          className={`${CARD_CONTAINER_CLASS} block p-4 text-left`}
        >
          <strong className="text-[#34495E]">{FINANCE_TILE.title}</strong>
          <p className="mt-1 text-xs text-[#7F8C8D]">{FINANCE_TILE.description}</p>
          <p className="mt-2 text-xs font-medium text-[#2980B9]">Open Finance (SSO) →</p>
        </button>
      </div>
    </>
  );
}
