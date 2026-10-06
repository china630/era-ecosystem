'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  Field,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';

const LOGO_MAX_BYTES = 512 * 1024;

type Profile = {
  name: string;
  propertyCode?: string;
  currency?: string;
  timezone?: string;
  roomCapacity?: number;
  bedCapacity: number | null;
  printName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoPath: string | null;
};

type TextKey = 'name' | 'printName' | 'address' | 'phone' | 'email' | 'website';

function blankProfile(): Profile {
  return {
    name: '',
    bedCapacity: null,
    printName: null,
    address: null,
    phone: null,
    email: null,
    website: null,
    logoPath: null,
  };
}

export function LetterheadSection() {
  const t = useTranslations('policies.letterhead');
  const tc = useTranslations('common');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState<'save' | 'logo' | null>(null);
  const [logoVersion, setLogoVersion] = useState(0);
  const [brokenLogo, setBrokenLogo] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/hotel/profile');
    if (!res.ok) return;
    const data = (await res.json()) as Profile | null;
    setProfile(data ?? blankProfile());
    setSaved(Boolean(data));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function setText(key: TextKey, value: string) {
    setProfile((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save() {
    if (!profile) return;
    setBusy('save');
    try {
      const res = await fetch('/api/hotel/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profile.name,
          bedCapacity: profile.bedCapacity,
          printName: profile.printName,
          address: profile.address,
          phone: profile.phone,
          email: profile.email,
          website: profile.website,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      setProfile(data as Profile);
      setSaved(true);
      showSuccess(tc('saved'));
    } finally {
      setBusy(null);
    }
  }

  async function uploadLogo(file: File) {
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      showApiError({ error: t('logoWrongType') }, t('logoWrongType'));
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      showApiError({ error: t('logoTooLarge') }, t('logoTooLarge'));
      return;
    }
    setBusy('logo');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/hotel/profile/logo', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      setProfile(data as Profile);
      setLogoVersion((v) => v + 1);
      showSuccess(tc('saved'));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removeLogo() {
    setBusy('logo');
    try {
      const res = await fetch('/api/hotel/profile/logo', { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      setProfile(data as Profile);
      showSuccess(tc('saved'));
    } finally {
      setBusy(null);
    }
  }

  const textFields: { key: TextKey; label: string; hint?: string; required?: boolean }[] = [
    { key: 'name', label: t('hotelName'), required: true },
    { key: 'printName', label: t('printName'), hint: t('printNameHint', { name: profile?.name ?? '' }) },
    { key: 'address', label: t('address') },
    { key: 'phone', label: t('phone') },
    { key: 'email', label: t('email') },
    { key: 'website', label: t('website') },
  ];

  return (
    <section id="letterhead" className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
      <h2 className="m-0 text-sm font-semibold text-[#34495E]">{t('title')}</h2>
      <p className="m-0 text-[13px] text-[#7F8C8D]">{t('hint')}</p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-16 w-40 items-center justify-center rounded border border-dashed border-[#D5DADF] bg-[#F4F5F7]">
          {profile?.logoPath && brokenLogo !== logoVersion ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/hotel/profile/logo?v=${logoVersion}`}
              alt={t('logo')}
              className="max-h-14 max-w-[9.5rem] object-contain"
              onError={() => setBrokenLogo(logoVersion)}
            />
          ) : (
            <span className="text-[12px] text-[#7F8C8D]">{t('logoNone')}</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={!profile || !saved || busy === 'logo'}
              title={saved ? undefined : t('logoSaveFirst')}
              onClick={() => fileRef.current?.click()}
            >
              {t('logoUpload')}
            </button>
            {profile?.logoPath ? (
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={busy === 'logo'}
                onClick={() => void removeLogo()}
              >
                {t('logoRemove')}
              </button>
            ) : null}
          </div>
          <span className="text-[12px] text-[#7F8C8D]">{saved ? t('logoHint') : t('logoSaveFirst')}</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            data-testid="letterhead-logo-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadLogo(file);
            }}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {textFields.map((f) => (
          <CatalogField
            key={f.key}
            kind="FREE_TEXT"
            name={`letterhead-${f.key}`}
            label={f.label}
            hint={f.hint}
            required={f.required}
            value={profile?.[f.key] ?? ''}
            options={[]}
            disabled={!profile}
            onChange={(next) => setText(f.key, String(next))}
          />
        ))}
        <Field
          label={t('bedCapacity')}
          hint={t('bedCapacityHint')}
          preset="count"
          type="number"
          min={0}
          name="letterhead-bedCapacity"
          value={profile?.bedCapacity ?? ''}
          disabled={!profile}
          onChange={(e) => {
            const raw = e.target.value;
            setProfile((prev) =>
              prev ? { ...prev, bedCapacity: raw === '' ? null : Math.max(0, Math.trunc(Number(raw))) } : prev,
            );
          }}
        />
      </div>

      <button
        type="button"
        className={PRIMARY_BUTTON_CLASS}
        disabled={!profile || !profile.name.trim() || busy === 'save'}
        onClick={() => void save()}
      >
        {tc('save')}
      </button>
    </section>
  );
}
