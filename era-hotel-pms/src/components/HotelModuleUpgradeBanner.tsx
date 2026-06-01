'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { orchPublicHref } from '@era/satellite-kit/ui';

export function useHotelModuleActive(moduleKey: string): boolean | null {
  const [active, setActive] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/platform/billing-snapshot')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const modules: string[] = Array.isArray(data?.activeModules)
          ? data.activeModules
          : [];
        const hotelMods = data?.hotelModules as Record<string, boolean> | undefined;
        if (hotelMods && moduleKey in hotelMods) {
          setActive(Boolean(hotelMods[moduleKey]));
          return;
        }
        setActive(modules.includes(moduleKey));
      })
      .catch(() => {
        if (!cancelled) setActive(null);
      });
    return () => {
      cancelled = true;
    };
  }, [moduleKey]);

  return active;
}

export default function HotelModuleUpgradeBanner({
  moduleKey,
  moduleLabelKey,
}: {
  moduleKey: string;
  moduleLabelKey: string;
}) {
  const t = useTranslations('billing');
  const active = useHotelModuleActive(moduleKey);

  if (active === null || active === true) return null;

  const pricingHref = orchPublicHref('/pricing#hospitality');

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-[#34495E]">
      <p className="font-semibold text-amber-900">
        {t('moduleLockedTitle', { module: t(moduleLabelKey as 'channelModule') })}
      </p>
      <p className="mt-1 text-[#7F8C8D]">{t('moduleLockedHint')}</p>
      {pricingHref ? (
        <a
          href={pricingHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 font-medium text-[#2980B9] hover:underline"
        >
          {t('upgradeOnOrchestrator')}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}
