'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  MODAL_INPUT_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';

type CompatRule = {
  id: string;
  procedureCodeA: string;
  procedureCodeB: string;
  ruleType: string;
  minHours: number | null;
  note?: string | null;
};

type SeqRule = {
  id: string;
  beforeCode: string;
  afterCode: string;
  kind: string;
  minGapMinutes: number;
};

export default function ProcedureRulesPage() {
  const t = useTranslations('procedureRules');
  const tc = useTranslations('common');
  const [tab, setTab] = useState<'compat' | 'sequence'>('compat');
  const [compatRules, setCompatRules] = useState<CompatRule[]>([]);
  const [seqRules, setSeqRules] = useState<SeqRule[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [compatForm, setCompatForm] = useState({
    procedureCodeA: '',
    procedureCodeB: '',
    ruleType: 'FORBID_SAME_DAY',
    minHours: '24',
    note: '',
  });
  const [seqForm, setSeqForm] = useState({
    beforeCode: '',
    afterCode: '',
    kind: 'SEQUENCE_GAP',
    minGapMinutes: '120',
  });

  const load = useCallback(async () => {
    const [c, s] = await Promise.all([
      fetch('/api/admin/procedure-compatibility-rules').then((r) => r.json()),
      fetch('/api/admin/procedure-rules').then((r) => r.json()),
    ]);
    setCompatRules((c.data ?? c) as CompatRule[]);
    setSeqRules((s.data ?? s) as SeqRule[]);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setCompatForm({
      procedureCodeA: '',
      procedureCodeB: '',
      ruleType: 'FORBID_SAME_DAY',
      minHours: '24',
      note: '',
    });
    setSeqForm({ beforeCode: '', afterCode: '', kind: 'SEQUENCE_GAP', minGapMinutes: '120' });
    setOpen(true);
  }

  function openEditCompat(row: CompatRule) {
    setEditingId(row.id);
    setCompatForm({
      procedureCodeA: row.procedureCodeA,
      procedureCodeB: row.procedureCodeB,
      ruleType: row.ruleType,
      minHours: String(row.minHours ?? 24),
      note: row.note ?? '',
    });
    setOpen(true);
  }

  function openEditSeq(row: SeqRule) {
    setEditingId(row.id);
    setSeqForm({
      beforeCode: row.beforeCode,
      afterCode: row.afterCode,
      kind: row.kind,
      minGapMinutes: String(row.minGapMinutes),
    });
    setOpen(true);
  }

  async function saveRule() {
    setMsg(null);
    if (tab === 'compat') {
      const payload = editingId
        ? {
            ruleType: compatForm.ruleType,
            minHours:
              compatForm.ruleType === 'MIN_HOURS_GAP' ? Number(compatForm.minHours) : null,
            note: compatForm.note || null,
          }
        : {
            ...compatForm,
            minHours:
              compatForm.ruleType === 'MIN_HOURS_GAP' ? Number(compatForm.minHours) : undefined,
          };
      const url = editingId
        ? `/api/admin/procedure-compatibility-rules/${editingId}`
        : '/api/admin/procedure-compatibility-rules';
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setMsg(res.ok ? (editingId ? tc('saved') : t('added')) : tc('failed'));
    } else {
      const payload = editingId
        ? {
            kind: seqForm.kind,
            minGapMinutes: Number(seqForm.minGapMinutes),
          }
        : {
            beforeCode: seqForm.beforeCode,
            afterCode: seqForm.afterCode,
            minGapMinutes: Number(seqForm.minGapMinutes),
          };
      const url = editingId ? `/api/admin/procedure-rules/${editingId}` : '/api/admin/procedure-rules';
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setMsg(res.ok ? (editingId ? tc('saved') : t('added')) : tc('failed'));
    }
    setOpen(false);
    await load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    if (tab === 'compat') {
      await fetch(`/api/admin/procedure-compatibility-rules?id=${deleteId}`, { method: 'DELETE' });
    } else {
      await fetch(`/api/admin/procedure-rules?id=${deleteId}`, { method: 'DELETE' });
    }
    setDeleteId(null);
    await load();
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
            {tc('add')}
          </button>
        }
      />
      {msg ? <p className="mb-4 text-[13px]">{msg}</p> : null}
      <div className="mb-4 flex gap-2">
        <button type="button" className={tab === 'compat' ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS} onClick={() => setTab('compat')}>
          {t('compatTab')}
        </button>
        <button type="button" className={tab === 'sequence' ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS} onClick={() => setTab('sequence')}>
          {t('sequenceTab')}
        </button>
      </div>
      <div className={`${CARD_CONTAINER_CLASS} p-4`}>
        {tab === 'compat' &&
          compatRules.map((r) => (
            <div key={r.id} className="mb-2 flex justify-between border-b pb-2 text-[13px]">
              <span>
                {r.procedureCodeA} ↔ {r.procedureCodeB} ({r.ruleType})
              </span>
              <span className="space-x-2">
                <button type="button" className="text-[#2980B9]" onClick={() => openEditCompat(r)}>
                  {tc('edit')}
                </button>
                <button type="button" className="text-[#C0392B]" onClick={() => setDeleteId(r.id)}>
                  {tc('delete')}
                </button>
              </span>
            </div>
          ))}
        {tab === 'sequence' &&
          seqRules.map((r) => (
            <div key={r.id} className="mb-2 flex justify-between border-b pb-2 text-[13px]">
              <span>
                {r.beforeCode} → {r.afterCode} ({r.minGapMinutes} min)
              </span>
              <span className="space-x-2">
                <button type="button" className="text-[#2980B9]" onClick={() => openEditSeq(r)}>
                  {tc('edit')}
                </button>
                <button type="button" className="text-[#C0392B]" onClick={() => setDeleteId(r.id)}>
                  {tc('delete')}
                </button>
              </span>
            </div>
          ))}
      </div>
      <ModalShell open={open} title={editingId ? tc('edit') : tc('add')} onClose={() => setOpen(false)}>
        {tab === 'compat' ? (
          <div className="space-y-2">
            {!editingId ? (
              <>
                <input className={MODAL_INPUT_CLASS} placeholder={t('codeA')} value={compatForm.procedureCodeA} onChange={(e) => setCompatForm({ ...compatForm, procedureCodeA: e.target.value })} />
                <input className={MODAL_INPUT_CLASS} placeholder={t('codeB')} value={compatForm.procedureCodeB} onChange={(e) => setCompatForm({ ...compatForm, procedureCodeB: e.target.value })} />
              </>
            ) : null}
            <select className={MODAL_INPUT_CLASS} value={compatForm.ruleType} onChange={(e) => setCompatForm({ ...compatForm, ruleType: e.target.value })}>
              <option value="FORBID_SAME_DAY">FORBID_SAME_DAY</option>
              <option value="MIN_HOURS_GAP">MIN_HOURS_GAP</option>
              <option value="FORBID_SEQUENCE">FORBID_SEQUENCE</option>
            </select>
            {compatForm.ruleType === 'MIN_HOURS_GAP' ? (
              <input className={MODAL_INPUT_CLASS} placeholder={t('minHours')} value={compatForm.minHours} onChange={(e) => setCompatForm({ ...compatForm, minHours: e.target.value })} />
            ) : null}
            <input className={MODAL_INPUT_CLASS} placeholder={t('note')} value={compatForm.note} onChange={(e) => setCompatForm({ ...compatForm, note: e.target.value })} />
          </div>
        ) : (
          <div className="space-y-2">
            {!editingId ? (
              <>
                <input className={MODAL_INPUT_CLASS} placeholder={t('codeA')} value={seqForm.beforeCode} onChange={(e) => setSeqForm({ ...seqForm, beforeCode: e.target.value })} />
                <input className={MODAL_INPUT_CLASS} placeholder={t('codeB')} value={seqForm.afterCode} onChange={(e) => setSeqForm({ ...seqForm, afterCode: e.target.value })} />
              </>
            ) : null}
            <select className={MODAL_INPUT_CLASS} value={seqForm.kind} onChange={(e) => setSeqForm({ ...seqForm, kind: e.target.value })}>
              <option value="SEQUENCE_GAP">SEQUENCE_GAP</option>
              <option value="MUTUAL_EXCLUSION">MUTUAL_EXCLUSION</option>
            </select>
            <input className={MODAL_INPUT_CLASS} placeholder={t('minGap')} value={seqForm.minGapMinutes} onChange={(e) => setSeqForm({ ...seqForm, minGapMinutes: e.target.value })} />
          </div>
        )}
        <ModalFooter onCancel={() => setOpen(false)} onSubmit={() => void saveRule()} submitLabel={tc('save')} />
      </ModalShell>

      <ModalShell open={!!deleteId} title={tc('confirmDelete')} onClose={() => setDeleteId(null)}>
        <ModalFooter onCancel={() => setDeleteId(null)} onSubmit={() => void confirmDelete()} submitLabel={tc('delete')} />
      </ModalShell>
    </>
  );
}
