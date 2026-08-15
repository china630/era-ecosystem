from pathlib import Path
import re

ROOT = Path(r"d:/My Projects/era-ecosystem/era-hotel-pms")

def w(rel: str, content: str):
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8", newline="\n")
    b = p.read_bytes()
    assert b[1] != 0, f"UTF-16 leak: {rel}"
    print("ok", rel, len(b))

# --- prompt pages using SimpleCrud addFields ---

w("app/spa/places/page.tsx", r'''\'use client\';

import { useTranslations } from \'next-intl\';
import { SimpleCrudPage } from \'@/components/wave-b/SimpleCrudPage\';
import { useAuth } from \'@/hooks/useAuth\';
import { PERMISSIONS } from \'@/lib/auth/permissions\';

export default function SpaPlacesPage() {
  const { can } = useAuth();
  const t = useTranslations(\'placesAndRooms\');
  const tc = useTranslations(\'common\');
  return (
    <SimpleCrudPage
      title={t(\'title\')}
      apiPath="/api/spa/places"
      canWrite={can(PERMISSIONS.MASTER_DATA_MANAGE)}
      addLabel={tc(\'add\')}
      addFields={[
        { name: \'code\', label: tc(\'code\'), preset: \'code\', required: true },
        { name: \'name\', label: tc(\'name\'), preset: \'longText\', required: true },
      ]}
      columns={[
        { key: \'code\', header: tc(\'code\') },
        { key: \'name\', header: tc(\'name\') },
        { key: \'capacity\', header: \'Capacity\' },
      ]}
    />
  );
}
'''.replace("\\'", "'"))

w("app/housekeeping/maids/page.tsx", r'''\'use client\';

import { useTranslations } from \'next-intl\';
import { SimpleCrudPage } from \'@/components/wave-b/SimpleCrudPage\';
import { useAuth } from \'@/hooks/useAuth\';
import { PERMISSIONS } from \'@/lib/auth/permissions\';

export default function MaidsPage() {
  const { can } = useAuth();
  const t = useTranslations(\'maidManagement\');
  const tc = useTranslations(\'common\');
  return (
    <SimpleCrudPage
      title={t(\'title\')}
      apiPath="/api/housekeeping/maids"
      canWrite={can(PERMISSIONS.HOUSEKEEPING_MANAGE)}
      addLabel={tc(\'add\')}
      addFields={[
        { name: \'code\', label: t(\'code\'), preset: \'code\', required: true },
        { name: \'name\', label: t(\'name\'), preset: \'longText\', required: true },
      ]}
      columns={[
        { key: \'code\', header: t(\'code\') },
        { key: \'name\', header: t(\'name\') },
        { key: \'tasks\', header: t(\'tasks\'), render: (r) => String((r.tasks as unknown[])?.length ?? 0) },
      ]}
    />
  );
}
'''.replace("\\'", "'"))

w("app/housekeeping/lost-and-found/page.tsx", r'''\'use client\';

import { useSearchParams } from \'next/navigation\';
import { useTranslations } from \'next-intl\';
import { SimpleCrudPage } from \'@/components/wave-b/SimpleCrudPage\';
import { useAuth } from \'@/hooks/useAuth\';
import { PERMISSIONS } from \'@/lib/auth/permissions\';

export default function LostAndFoundPage() {
  const { can } = useAuth();
  const searchParams = useSearchParams();
  const guestId = searchParams.get(\'guestId\');
  const t = useTranslations(\'lostAndFound\');
  const tc = useTranslations(\'common\');
  const apiPath = guestId
    ? `/api/housekeeping/lost-found?guestId=${encodeURIComponent(guestId)}`
    : \'/api/housekeeping/lost-found\';
  return (
    <SimpleCrudPage
      title={t(\'title\')}
      apiPath={apiPath}
      postPath="/api/housekeeping/lost-found"
      canWrite={can(PERMISSIONS.HOUSEKEEPING_MANAGE)}
      addLabel={tc(\'add\')}
      addFields={[
        { name: \'location\', label: t(\'location\'), preset: \'longText\', required: true },
        { name: \'description\', label: t(\'description\'), preset: \'longText\', required: true, multiline: true },
      ]}
      buildAddBody={(values) => ({
        foundDate: new Date().toISOString().slice(0, 10),
        location: values.location,
        description: values.description,
        ...(guestId ? { guestId } : {}),
      })}
      columns={[
        { key: \'foundDate\', header: t(\'date\'), render: (r) => String(r.foundDate).slice(0, 10) },
        { key: \'location\', header: t(\'location\') },
        { key: \'description\', header: t(\'description\') },
        { key: \'status\', header: t(\'status\') },
      ]}
    />
  );
}
'''.replace("\\'", "'"))

w("app/admin/child-matrix/page.tsx", r'''\'use client\';

import { useTranslations } from \'next-intl\';
import { SimpleCrudPage } from \'@/components/wave-b/SimpleCrudPage\';
import { useAuth } from \'@/hooks/useAuth\';
import { PERMISSIONS } from \'@/lib/auth/permissions\';

export default function ChildMatrixPage() {
  const { can } = useAuth();
  const t = useTranslations(\'childMatrix\');
  const tc = useTranslations(\'common\');
  return (
    <SimpleCrudPage
      title={t(\'title\')}
      apiPath="/api/admin/child-matrix"
      canWrite={can(PERMISSIONS.MASTER_DATA_MANAGE)}
      addLabel={tc(\'add\')}
      addFields={[
        { name: \'ageFrom\', label: t(\'ageFrom\'), preset: \'count\', type: \'number\', defaultValue: \'0\', required: true },
        { name: \'ageTo\', label: t(\'ageTo\'), preset: \'count\', type: \'number\', defaultValue: \'6\', required: true },
        { name: \'discountPercent\', label: t(\'discount\'), preset: \'count\', type: \'number\', defaultValue: \'50\', required: true },
      ]}
      buildAddBody={(values) => ({
        ageFrom: Number(values.ageFrom),
        ageTo: Number(values.ageTo),
        discountPercent: Number(values.discountPercent),
      })}
      columns={[
        { key: \'ageFrom\', header: t(\'ageFrom\') },
        { key: \'ageTo\', header: t(\'ageTo\') },
        { key: \'discountPercent\', header: t(\'discount\') },
      ]}
    />
  );
}
'''.replace("\\'", "'"))

w("app/admin/promotion-codes/page.tsx", r'''\'use client\';

import { useTranslations } from \'next-intl\';
import { SimpleCrudPage } from \'@/components/wave-b/SimpleCrudPage\';
import { useAuth } from \'@/hooks/useAuth\';
import { PERMISSIONS } from \'@/lib/auth/permissions\';

export default function PromotionCodesPage() {
  const { can } = useAuth();
  const t = useTranslations(\'promotionCodes\');
  const tc = useTranslations(\'common\');
  return (
    <SimpleCrudPage
      title={t(\'title\')}
      apiPath="/api/admin/promotion-codes"
      canWrite={can(PERMISSIONS.MASTER_DATA_MANAGE)}
      addLabel={tc(\'add\')}
      addFields={[
        { name: \'code\', label: t(\'code\'), preset: \'code\', required: true },
        { name: \'discountPercent\', label: t(\'discount\'), preset: \'count\', type: \'number\', defaultValue: \'10\', required: true },
      ]}
      buildAddBody={(values) => ({
        code: values.code,
        discountPercent: Number(values.discountPercent),
        validFrom: new Date().toISOString().slice(0, 10),
      })}
      columns={[
        { key: \'code\', header: t(\'code\') },
        { key: \'discountPercent\', header: t(\'discount\') },
        { key: \'active\', header: t(\'active\'), render: (r) => String(r.active) },
      ]}
    />
  );
}
'''.replace("\\'", "'"))

w("app/housekeeping/minibar/page.tsx", r'''\'use client\';

import { useCallback, useEffect, useState } from \'react\';
import { useTranslations } from \'next-intl\';
import {
  Field,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from \'@era/satellite-kit/ui\';

export default function MinibarPage() {
  const t = useTranslations(\'minibarControl\');
  const tc = useTranslations(\'common\');
  const [items, setItems] = useState<Array<{ id: string; code: string; name: string; price: number }>>([]);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(\'\');
  const [name, setName] = useState(\'\');
  const [price, setPrice] = useState(\'5\');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(\'/api/housekeeping/minibar\');
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, tc(\'loadError\'));
        return;
      }
      setItems(data.items ?? []);
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc(\'loadError\') });
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  function openModal() {
    setCode(\'\');
    setName(\'\');
    setPrice(\'5\');
    setOpen(true);
  }

  async function submit() {
    if (!code.trim() || !name.trim()) {
      showApiError({ error: tc(\'required\') });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(\'/api/housekeeping/minibar\', {
        method: \'POST\',
        headers: { \'Content-Type\': \'application/json\' },
        body: JSON.stringify({ code, name, price: Number(price) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showApiError(data, tc(\'failed\'));
        return;
      }
      showSuccess(tc(\'saved\'));
      setOpen(false);
      await load();
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc(\'failed\') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t(\'title\')}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openModal}>
            {tc(\'add\')}
          </button>
        }
      />
      <ul className="space-y-2 text-[13px]">
        {items.map((i) => (
          <li key={i.id} className="rounded border px-3 py-2">
            {i.code} — {i.name} · {i.price} AZN
          </li>
        ))}
      </ul>
      <ModalShell
        open={open}
        title={t(\'title\')}
        onClose={() => !busy && setOpen(false)}
        closeLabel={tc(\'close\')}
        footer={
          <ModalFooter
            onCancel={() => !busy && setOpen(false)}
            onSubmit={() => void submit()}
            busy={busy}
            cancelLabel={tc(\'cancel\')}
            submitLabel={tc(\'save\')}
          />
        }
      >
        <div className="space-y-3">
          <Field label={tc(\'code\')} preset="code" value={code} onChange={(e) => setCode(e.target.value)} required />
          <Field label={tc(\'name\')} preset="longText" value={name} onChange={(e) => setName(e.target.value)} required />
          <Field
            label={tc(\'amount\')}
            preset="amount"
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>
      </ModalShell>
    </>
  );
}
'''.replace("\\'", "'"))

print("prompt pages done")
