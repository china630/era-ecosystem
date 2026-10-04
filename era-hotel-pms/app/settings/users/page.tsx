'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Pencil, Plus } from 'lucide-react';
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  EraListFilterBar,
  useDebouncedValue,
  Field,
  FieldSelect,
  FORM_STACK_CLASS,
  PRIMARY_BUTTON_CLASS,
  PageHeader,
  showApiError,
  showSuccess,
} from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';

interface Role {
  id: string;
  code: string;
  name: string;
}

interface UserRow {
  id: string;
  login: string;
  fullName: string;
  role: string;
  status: string;
  isCrossSystem?: boolean;
  cpEmploymentId?: string | null;
  positionTitle?: string | null;
}

export default function AdminUsersPage() {
  const t = useTranslations('users');
  const tc = useTranslations('common');
  const tAuth = useTranslations('auth');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [login, setLogin] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [quotaError, setQuotaError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);

  const load = useCallback(async () => {
    try {
      const [uRes, rRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/roles'),
      ]);
      if (uRes.ok) setUsers(await uRes.json());
      else showApiError(await uRes.json().catch(() => ({})), tc('loadError'));
      if (rRes.ok) {
        const r = await rRes.json();
        setRoles(r);
        setRoleId((prev) => prev || r[0]?.id || '');
      }
    } catch (e) {
      showApiError({ error: e instanceof Error ? e.message : tc('loadError') });
    }
  }, [tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredUsers = useMemo(() => {
    const query = debouncedQ.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (statusFilter && u.status !== statusFilter) return false;
      if (!query) return true;
      return (
        u.login.toLowerCase().includes(query) ||
        u.fullName.toLowerCase().includes(query) ||
        (u.positionTitle ?? '').toLowerCase().includes(query) ||
        u.role.toLowerCase().includes(query)
      );
    });
  }, [users, debouncedQ, roleFilter, statusFilter]);

  const editing = editId != null;
  const editingUser = users.find((u) => u.id === editId);
  const workforceLocked = Boolean(editingUser?.cpEmploymentId);
  const passwordLocked = workforceLocked || Boolean(editingUser?.isCrossSystem);

  function openCreate() {
    setEditId(null);
    setLogin('');
    setFullName('');
    setPassword('');
    setStatus('ACTIVE');
    setRoleId(roles[0]?.id || '');
    setModalOpen(true);
  }

  function openEdit(u: UserRow) {
    setEditId(u.id);
    setLogin(u.login);
    setFullName(u.fullName);
    setPassword('');
    setStatus(u.status || 'ACTIVE');
    const role = roles.find((r) => r.code === u.role);
    setRoleId(role?.id || roles[0]?.id || '');
    setModalOpen(true);
  }

  async function submitUser(e: React.FormEvent) {
    e.preventDefault();
    if (!roleId) {
      showApiError({ error: tc('required') }, tc('failed'));
      return;
    }
    setBusy(true);
    setQuotaError(false);
    try {
      if (editing && editId) {
        const body: Record<string, unknown> = { roleId, status };
        if (!workforceLocked) body.fullName = fullName;
        if (!passwordLocked && password.trim()) body.password = password;
        const res = await fetch(`/api/admin/users/${editId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        setBusy(false);
        if (!res.ok) {
          showApiError(data, tc('failed'));
          return;
        }
        setModalOpen(false);
        showSuccess(t('userUpdated', { login: data.login ?? login }));
        await load();
        return;
      }

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, fullName, password, roleId }),
      });
      const data = await res.json();
      setBusy(false);
      if (res.status === 403) {
        setQuotaError(true);
        showApiError(data, t('seatQuotaExceeded'));
        return;
      }
      if (!res.ok) {
        showApiError(data, tc('failed'));
        return;
      }
      setModalOpen(false);
      showSuccess(t('userCreated', { login: data.login }));
      await load();
    } catch (err) {
      setBusy(false);
      showApiError({ error: err instanceof Error ? err.message : tc('failed') });
    }
  }

  const formId = 'user-form';

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('localLoginHint')}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            {t('createUser')}
          </button>
        }
      />

      {quotaError && (
        <section className={`${CARD_CONTAINER_CLASS} mb-4 border-rose-200 bg-rose-50 p-4 text-[13px] text-rose-800`}>
          {t('quotaExceeded')}
        </section>
      )}

      <EraListFilterBar
        resetLabel={tc('filterReset')}
        onReset={() => {
          setQ('');
          setRoleFilter('');
          setStatusFilter('');
        }}
      >
        <Field
          label={tc('search')}
          preset="longText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <CatalogField
          kind="SEARCHABLE"
          label={t('role')}
          value={roleFilter}
          onChange={(v) => setRoleFilter(String(v ?? ''))}
          options={roles.map((r) => ({ value: r.code, label: r.code }))}
          emptyLabel={t('allRoles')}
          widthPreset="select"
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={tc('status')}
          value={statusFilter}
          onChange={(v) => setStatusFilter(String(v ?? ''))}
          options={[
            { value: 'ACTIVE', label: 'ACTIVE' },
            { value: 'DISABLED', label: 'DISABLED' },
          ]}
          emptyLabel={t('allStatuses')}
          widthPreset="select"
        />
      </EraListFilterBar>

      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tAuth('login')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('name')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('position')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('role')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('status')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => (
              <tr key={u.id} className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS}>{u.login}</td>
                <td className={DATA_TABLE_TD_CLASS}>{u.fullName}</td>
                <td className={DATA_TABLE_TD_CLASS}>{u.positionTitle || tc('dash')}</td>
                <td className={DATA_TABLE_TD_CLASS}>{u.role}</td>
                <td className={DATA_TABLE_TD_CLASS}>{u.status}</td>
                <td className={DATA_TABLE_TD_CLASS}>
                  <button
                    type="button"
                    className="inline-flex rounded p-1 text-[#2980B9] hover:bg-[#EBF5FB]"
                    aria-label={tc('edit')}
                    onClick={() => openEdit(u)}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <EraModal
        open={modalOpen}
        title={editing ? t('editUser') : t('createUser')}
        onClose={() => setModalOpen(false)}
        footer={
          <EraModalFooter
            formId={formId}
            onCancel={() => setModalOpen(false)}
            busy={busy}
            submitLabel={editing ? tc('save') : t('createUser')}
          />
        }
      >
        <form id={formId} onSubmit={submitUser} className={FORM_STACK_CLASS}>
          <Field
            label={tAuth('login')}
            preset="code"
            id="user-login"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            required
            disabled={editing}
          />
          <Field
            label={t('fullName')}
            preset="shortText"
            id="user-fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            disabled={workforceLocked}
            hint={workforceLocked ? t('workforceNameLocked') : undefined}
          />
          {passwordLocked ? null : (
            <Field
              label={editing ? t('newPasswordOptional') : tAuth('password')}
              preset="shortText"
              id="user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!editing}
            />
          )}
          <CatalogField
            kind="SEARCHABLE"
            label={t('role')}
            id="user-role"
            value={roleId}
            onChange={(v) => setRoleId(String(v ?? ''))}
            options={roles.map((r) => ({ value: r.id, label: r.code }))}
            required
            emptyLabel={null}
          />
          {editing ? (
            <FieldSelect
              label={tc('status')}
              preset="select"
              id="user-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="DISABLED">DISABLED</option>
            </FieldSelect>
          ) : null}
        </form>
      </EraModal>
    </>
  );
}
