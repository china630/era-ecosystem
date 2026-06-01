'use client';

import { useTranslations } from 'next-intl';
import { HotelModuleScreen } from '@/components/HotelModuleScreen';

type Props = {
  titleKey: string;
  moduleKey: string;
};

export function HotelParityPage({ titleKey, moduleKey }: Props) {
  const t = useTranslations('nav');
  return <HotelModuleScreen title={t(titleKey as 'chessboard')} moduleKey={moduleKey} />;
}
