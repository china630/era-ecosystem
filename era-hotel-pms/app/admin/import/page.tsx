'use client';



import { useEffect, useState } from 'react';

import { useTranslations } from 'next-intl';

import { PageHeader } from '@era/satellite-kit/ui';

import AppShell, { StatusMessage } from '@/components/layout/AppShell';

import { ImportWizard } from '@/components/import/ImportWizard';

import { useAuth } from '@/hooks/useAuth';



type ImportEntity = {

  entity: string;

  label: string;

  order: number;

  templateHint: string;

};



export default function AdminImportPage() {

  const t = useTranslations('elektrawebImport');

  const { isPlatformSuperAdmin, loading } = useAuth();

  const [entities, setEntities] = useState<ImportEntity[]>([]);

  const [msg, setMsg] = useState<string | null>(null);



  useEffect(() => {

    if (!isPlatformSuperAdmin) return;

    fetch('/api/import')

      .then((r) => r.json())

      .then(setEntities)

      .catch(() => setMsg(t('loadError')));

  }, [isPlatformSuperAdmin, t]);



  if (loading) {

    return (

      <AppShell>

        <p className="text-sm text-[#7F8C8D]">{t('loading')}</p>

      </AppShell>

    );

  }



  if (!isPlatformSuperAdmin) {

    return (

      <AppShell>

        <p className="text-sm text-red-600">{t('superAdminOnly')}</p>

      </AppShell>

    );

  }



  return (

    <AppShell maxWidthClass="max-w-3xl">

      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <StatusMessage>{msg}</StatusMessage>

      <ImportWizard entities={entities} />

    </AppShell>

  );

}

