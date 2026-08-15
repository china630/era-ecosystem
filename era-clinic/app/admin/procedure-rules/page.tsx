'use client';

import { useCallback, useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  CARD_CONTAINER_CLASS,
  Field,
  FieldSelect,
  FORM_STACK_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_MUTED_CLASS,
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

type RotationRule = {
  id: string;
  code: string;
  name: string;
  memberCodes: string[];
  scope: string;
  maxConsecutiveDays: number;
  restProcedureCode?: string | null;
};

type SubstitutionRule = {
  id: string;
  originalCode: string;
  substituteCode: string;
  note?: string | null;
};

const COMPAT_RULE_TYPES = ['FORBID_SAME_DAY', 'MIN_HOURS_GAP', 'FORBID_SEQUENCE'] as const;
const SEQ_KINDS = ['SEQUENCE_GAP', 'MUTUAL_EXCLUSION'] as const;
type TabId = 'compat' | 'sequence' | 'rotation' | 'substitution';

export default function ProcedureRulesPage() {
  const t = useTranslations('procedureRules');
  const tc = useTranslations('common');
  const [tab, setTab] = useState<TabId>('compat');
  const [compatRules, setCompatRules] = useState<CompatRule[]>([]);
  const [seqRules, setSeqRules] = useState<SeqRule[]>([]);
  const [rotationRules, setRotationRules] = useState<RotationRule[]>([]);
  const [substitutionRules, setSubstitutionRules] = useState<SubstitutionRule[]>([]);
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
  const [rotationForm, setRotationForm] = useState({
    code: '',
    name: '',
    memberCodes: '',
    scope: 'GROUP',
    maxConsecutiveDays: '1',
    restProcedureCode: '',
  });
  const [substitutionForm, setSubstitutionForm] = useState({
    originalCode: '',
    substituteCode: '',
    note: '',
  });

  const load = useCallback(async () => {
    const [c, s, rot, sub] = await Promise.all([
      fetch('/api/admin/procedure-compatibility-rules').then((r) => r.json()),
      fetch('/api/admin/procedure-rules').then((r) => r.json()),
      fetch('/api/admin/procedure-rotation-rules').then((r) => r.json()),
      fetch('/api/admin/procedure-substitution-rules').then((r) => r.json()),
    ]);
    setCompatRules((c.data ?? c) as CompatRule[]);
    setSeqRules((s.data ?? s) as SeqRule[]);
    setRotationRules((rot.data ?? rot) as RotationRule[]);
    setSubstitutionRules((sub.data ?? sub) as SubstitutionRule[]);
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
    setRotationForm({
      code: '',
      name: '',
      memberCodes: '',
      scope: 'GROUP',
      maxConsecutiveDays: '1',
      restProcedureCode: '',
    });
    setSubstitutionForm({ originalCode: '', substituteCode: '', note: '' });
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
    } else if (tab === 'sequence') {
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
    } else if (tab === 'rotation') {
      const memberCodes = rotationForm.memberCodes
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      const res = await fetch('/api/admin/procedure-rotation-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: rotationForm.code,
          name: rotationForm.name,
          memberCodes,
          scope: rotationForm.scope,
          maxConsecutiveDays: Number(rotationForm.maxConsecutiveDays) || 1,
          restProcedureCode: rotationForm.restProcedureCode.trim() || null,
        }),
      });
      setMsg(res.ok ? t('added') : tc('failed'));
    } else {
      const res = await fetch('/api/admin/procedure-substitution-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalCode: substitutionForm.originalCode,
          substituteCode: substitutionForm.substituteCode,
          note: substitutionForm.note || null,
        }),
      });
      setMsg(res.ok ? t('added') : tc('failed'));
    }
    setOpen(false);
    await load();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    if (tab === 'compat') {
      await fetch(`/api/admin/procedure-compatibility-rules?id=${deleteId}`, { method: 'DELETE' });
    } else if (tab === 'sequence') {
      await fetch(`/api/admin/procedure-rules?id=${deleteId}`, { method: 'DELETE' });
    } else if (tab === 'rotation') {
      await fetch(`/api/admin/procedure-rotation-rules?id=${deleteId}`, { method: 'DELETE' });
    } else {
      await fetch(`/api/admin/procedure-substitution-rules?id=${deleteId}`, { method: 'DELETE' });
    }
    setDeleteId(null);
    await load();
  }

  function compatRuleLabel(ruleType: string) {
    const key = `ruleType_${ruleType}` as 'ruleType_FORBID_SAME_DAY';
    try {
      return t(key);
    } catch {
      return ruleType;
    }
  }

  function seqKindLabel(kind: string) {
    const key = `kind_${kind}` as 'kind_SEQUENCE_GAP';
    try {
      return t(key);
    } catch {
      return kind;
    }
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
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ['compat', t('compatTab')],
            ['sequence', t('sequenceTab')],
            ['rotation', t('rotationTab')],
            ['substitution', t('substitutionTab')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={`${CARD_CONTAINER_CLASS} p-4`}>
        {tab === 'compat' && compatRules.length === 0 ? (
          <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{t('empty')}</p>
        ) : null}
        {tab === 'compat' &&
          compatRules.map((r) => (
            <div key={r.id} className="mb-2 flex justify-between border-b pb-2 text-[13px]">
              <span>
                {r.procedureCodeA} ↔ {r.procedureCodeB} ({compatRuleLabel(r.ruleType)})
                {r.ruleType === 'MIN_HOURS_GAP' && r.minHours != null ? ` · ${r.minHours}h` : ''}
              </span>
              <span className="flex gap-1">
                <button
                  type="button"
                  className={TABLE_ROW_ICON_BTN_CLASS}
                  aria-label={tc('edit')}
                  onClick={() => openEditCompat(r)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  className={TABLE_ROW_ICON_BTN_CLASS}
                  aria-label={tc('delete')}
                  onClick={() => setDeleteId(r.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </span>
            </div>
          ))}
        {tab === 'sequence' && seqRules.length === 0 ? (
          <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{t('empty')}</p>
        ) : null}
        {tab === 'sequence' &&
          seqRules.map((r) => (
            <div key={r.id} className="mb-2 flex justify-between border-b pb-2 text-[13px]">
              <span>
                {r.beforeCode} → {r.afterCode} · {seqKindLabel(r.kind)} · {r.minGapMinutes} min
              </span>
              <span className="flex gap-1">
                <button
                  type="button"
                  className={TABLE_ROW_ICON_BTN_CLASS}
                  aria-label={tc('edit')}
                  onClick={() => openEditSeq(r)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  className={TABLE_ROW_ICON_BTN_CLASS}
                  aria-label={tc('delete')}
                  onClick={() => setDeleteId(r.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </span>
            </div>
          ))}
        {tab === 'rotation' && rotationRules.length === 0 ? (
          <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{t('empty')}</p>
        ) : null}
        {tab === 'rotation' &&
          rotationRules.map((r) => (
            <div key={r.id} className="mb-2 flex justify-between border-b pb-2 text-[13px]">
              <span>
                {r.name} · {r.code} · {r.scope} · max {r.maxConsecutiveDays}d ·{' '}
                {(r.memberCodes ?? []).join(', ')}
                {r.restProcedureCode ? ` · rest ${r.restProcedureCode}` : ''}
              </span>
              <button
                type="button"
                className={TABLE_ROW_ICON_BTN_CLASS}
                aria-label={tc('delete')}
                onClick={() => setDeleteId(r.id)}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ))}
        {tab === 'substitution' && substitutionRules.length === 0 ? (
          <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{t('empty')}</p>
        ) : null}
        {tab === 'substitution' &&
          substitutionRules.map((r) => (
            <div key={r.id} className="mb-2 flex justify-between border-b pb-2 text-[13px]">
              <span>
                {r.originalCode} → {r.substituteCode}
                {r.note ? ` · ${r.note}` : ''}
              </span>
              <button
                type="button"
                className={TABLE_ROW_ICON_BTN_CLASS}
                aria-label={tc('delete')}
                onClick={() => setDeleteId(r.id)}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ))}
      </div>
      <ModalShell open={open} title={editingId ? tc('edit') : tc('add')} onClose={() => setOpen(false)}>
        {tab === 'compat' ? (
          <div className={FORM_STACK_CLASS}>
            {!editingId ? (
              <>
                <Field
                  label={t('codeA')}
                  preset="code"
                  value={compatForm.procedureCodeA}
                  onChange={(e) => setCompatForm({ ...compatForm, procedureCodeA: e.target.value })}
                />
                <Field
                  label={t('codeB')}
                  preset="code"
                  value={compatForm.procedureCodeB}
                  onChange={(e) => setCompatForm({ ...compatForm, procedureCodeB: e.target.value })}
                />
              </>
            ) : null}
            <FieldSelect
              label={t('ruleType')}
              preset="select"
              value={compatForm.ruleType}
              onChange={(e) => setCompatForm({ ...compatForm, ruleType: e.target.value })}
            >
              {COMPAT_RULE_TYPES.map((rt) => (
                <option key={rt} value={rt}>
                  {compatRuleLabel(rt)}
                </option>
              ))}
            </FieldSelect>
            {compatForm.ruleType === 'MIN_HOURS_GAP' ? (
              <Field
                label={t('minHours')}
                preset="count"
                type="number"
                min={1}
                value={compatForm.minHours}
                onChange={(e) => setCompatForm({ ...compatForm, minHours: e.target.value })}
              />
            ) : null}
            <Field
              label={t('note')}
              preset="longText"
              value={compatForm.note}
              onChange={(e) => setCompatForm({ ...compatForm, note: e.target.value })}
            />
          </div>
        ) : tab === 'sequence' ? (
          <div className={FORM_STACK_CLASS}>
            {!editingId ? (
              <>
                <Field
                  label={t('beforeCode')}
                  preset="code"
                  value={seqForm.beforeCode}
                  onChange={(e) => setSeqForm({ ...seqForm, beforeCode: e.target.value })}
                />
                <Field
                  label={t('afterCode')}
                  preset="code"
                  value={seqForm.afterCode}
                  onChange={(e) => setSeqForm({ ...seqForm, afterCode: e.target.value })}
                />
              </>
            ) : null}
            <FieldSelect
              label={t('kind')}
              preset="select"
              value={seqForm.kind}
              onChange={(e) => setSeqForm({ ...seqForm, kind: e.target.value })}
            >
              {SEQ_KINDS.map((k) => (
                <option key={k} value={k}>
                  {seqKindLabel(k)}
                </option>
              ))}
            </FieldSelect>
            <Field
              label={t('minGapMinutes')}
              preset="count"
              type="number"
              min={0}
              value={seqForm.minGapMinutes}
              onChange={(e) => setSeqForm({ ...seqForm, minGapMinutes: e.target.value })}
            />
          </div>
        ) : tab === 'rotation' ? (
          <div className={FORM_STACK_CLASS}>
            <Field
              label={t('code')}
              preset="code"
              value={rotationForm.code}
              onChange={(e) => setRotationForm({ ...rotationForm, code: e.target.value })}
            />
            <Field
              label={t('name')}
              preset="shortText"
              value={rotationForm.name}
              onChange={(e) => setRotationForm({ ...rotationForm, name: e.target.value })}
            />
            <Field
              label={t('memberCodes')}
              preset="longText"
              value={rotationForm.memberCodes}
              onChange={(e) => setRotationForm({ ...rotationForm, memberCodes: e.target.value })}
            />
            <FieldSelect
              label={t('scope')}
              preset="select"
              value={rotationForm.scope}
              onChange={(e) => setRotationForm({ ...rotationForm, scope: e.target.value })}
            >
              <option value="GROUP">GROUP</option>
              <option value="BODY_PART">BODY_PART</option>
            </FieldSelect>
            <Field
              label={t('maxConsecutiveDays')}
              preset="count"
              type="number"
              min={1}
              max={14}
              value={rotationForm.maxConsecutiveDays}
              onChange={(e) => setRotationForm({ ...rotationForm, maxConsecutiveDays: e.target.value })}
            />
            <Field
              label={t('restProcedureCode')}
              preset="code"
              value={rotationForm.restProcedureCode}
              onChange={(e) => setRotationForm({ ...rotationForm, restProcedureCode: e.target.value })}
            />
          </div>
        ) : (
          <div className={FORM_STACK_CLASS}>
            <Field
              label={t('originalCode')}
              preset="code"
              value={substitutionForm.originalCode}
              onChange={(e) => setSubstitutionForm({ ...substitutionForm, originalCode: e.target.value })}
            />
            <Field
              label={t('substituteCode')}
              preset="code"
              value={substitutionForm.substituteCode}
              onChange={(e) => setSubstitutionForm({ ...substitutionForm, substituteCode: e.target.value })}
            />
            <Field
              label={t('note')}
              preset="longText"
              value={substitutionForm.note}
              onChange={(e) => setSubstitutionForm({ ...substitutionForm, note: e.target.value })}
            />
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
