'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';

type Binding = {
  provider: 'off' | 'stub' | 'webhook' | 'channex';
  channexPropertyId: string | null;
  propertyType: 'hotel' | 'vacation_rental';
  live: boolean;
  ibePublishableKey: string | null;
  ibeAllowedOrigins: string[];
  hasWebhookSecret: boolean;
};

export function ChannelBindingCard({ onSaved }: { onSaved?: () => void }) {
  const t = useTranslations('channel');
  const [binding, setBinding] = useState<Binding | null>(null);
  const [provider, setProvider] = useState<Binding['provider']>('off');
  const [propertyId, setPropertyId] = useState('');
  const [propertyType, setPropertyType] = useState<'hotel' | 'vacation_rental'>('hotel');
  const [origins, setOrigins] = useState('');
  const [live, setLive] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch('/api/channel/binding')
      .then((r) => r.json())
      .then((d) => {
        const b = (d.data ?? d) as Binding;
        setBinding(b);
        setProvider(b.provider ?? 'off');
        setPropertyId(b.channexPropertyId ?? '');
        setPropertyType(b.propertyType ?? 'hotel');
        setOrigins((b.ibeAllowedOrigins ?? []).join('\n'));
        setLive(Boolean(b.live));
      })
      .catch((err) => showApiError(err));
  }, []);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch('/api/channel/binding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          channexPropertyId: propertyId.trim() || null,
          propertyType,
          live,
          ibeAllowedOrigins: origins
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter(Boolean),
          ...(webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? json.message ?? 'Save failed');
      const b = (json.data ?? json) as Binding;
      setBinding(b);
      setWebhookSecret('');
      showSuccess(t('bindingSaved'));
      onSaved?.();
    } catch (err) {
      showApiError(err);
    } finally {
      setBusy(false);
    }
  }

  async function rotateKey() {
    setBusy(true);
    try {
      const res = await fetch('/api/channel/binding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotateIbeKey: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? json.message ?? 'Rotate failed');
      setBinding((json.data ?? json) as Binding);
      showSuccess(t('bindingKeyRotated'));
    } catch (err) {
      showApiError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`${CARD_CONTAINER_CLASS} p-4`}>
      <h2 className="m-0 text-sm font-semibold text-[#34495E]">{t('bindingTitle')}</h2>
      <p className="mt-1 text-[13px] text-[#7F8C8D]">{t('bindingHint')}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('bindingProvider')}
          value={provider}
          onChange={(v) => setProvider(String(v) as Binding['provider'])}
          options={[
            { value: 'off', label: 'off' },
            { value: 'stub', label: 'stub' },
            { value: 'webhook', label: 'webhook' },
            { value: 'channex', label: 'channex' },
          ]}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t('bindingPropertyType')}
          value={propertyType}
          onChange={(v) => setPropertyType(String(v) as 'hotel' | 'vacation_rental')}
          options={[
            { value: 'hotel', label: 'hotel' },
            { value: 'vacation_rental', label: 'vacation_rental' },
          ]}
        />
        <label className="block text-[13px] text-[#34495E]">
          {t('bindingPropertyId')}
          <input
            className="mt-1 w-full rounded-lg border border-[#D5DADF] px-2.5 py-2 text-sm"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            placeholder="channex property uuid"
          />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-[#34495E]">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
          {t('bindingLive')}
        </label>
        <label className="block text-[13px] text-[#34495E] md:col-span-2">
          {t('bindingWebhookSecret')}
          <input
            className="mt-1 w-full rounded-lg border border-[#D5DADF] px-2.5 py-2 text-sm"
            type="password"
            autoComplete="off"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder={binding?.hasWebhookSecret ? '••••••••' : ''}
          />
        </label>
        <label className="block text-[13px] text-[#34495E] md:col-span-2">
          {t('bindingOrigins')}
          <textarea
            className="mt-1 w-full rounded-lg border border-[#D5DADF] px-2.5 py-2 text-sm"
            rows={3}
            value={origins}
            onChange={(e) => setOrigins(e.target.value)}
            placeholder="https://hotel.example.com"
          />
        </label>
        {binding?.ibePublishableKey ? (
          <p className="md:col-span-2 break-all text-[12px] text-[#7F8C8D]">
            {t('bindingIbeKey')}: <code>{binding.ibePublishableKey}</code>
          </p>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={() => void save()}>
          {t('bindingSave')}
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={busy}
          onClick={() => void rotateKey()}
        >
          {t('bindingRotateKey')}
        </button>
      </div>
    </section>
  );
}
