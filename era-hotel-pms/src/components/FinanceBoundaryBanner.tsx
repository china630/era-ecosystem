'use client';

import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { financeDeepLink, type FinanceDeepLinkTarget } from '@/lib/finance-links';

type Props = {
  target: FinanceDeepLinkTarget;
  labelKey?: 'openInFinance' | 'openPurchasesInFinance' | 'openInventoryInFinance';
};

export default function FinanceBoundaryBanner({ target, labelKey = 'openInFinance' }: Props) {
  const t = useTranslations('finance');
  const href = financeDeepLink(target);
  if (!href) return null;

  return (
    <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] text-[#34495E]">
      <p className="text-[#7F8C8D]">{t('boundaryNote')}</p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 font-medium text-sky-700 hover:underline"
      >
        {t(labelKey)}
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </a>
    </div>
  );
}
