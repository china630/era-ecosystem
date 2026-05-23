'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from '@era/satellite-kit/ui';
import { PageHeader } from '@era/satellite-kit/ui';
import { EraModal, EraModalFooter } from '@/components/EraModal';
import AppShell, { PageSection, StatusMessage } from '@/components/layout/AppShell';

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
}

export default function AdminUsersPage() {
  const t = useTranslations('users');
  const tc = useTranslations('common');
  const tAuth = useTranslations('auth');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [login, setLogin] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [uRes, rRes] = await Promise.all([
      fetch('/api/admin/users'),
      fetch('/api/admin/roles'),
    ]);
    if (uRes.ok) setUsers(await uRes.json());
    if (rRes.ok) {
      const r = await rRes.json();
      setRoles(r);
      setRoleId((prev) => prev || r[0]?.id || '');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setLogin('');
    setFullName('');
    setPassword('');
    setRoleId(roles[0]?.id || '');
    setModalOpen(true);
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setQuotaError(false);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, fullName, password, roleId }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.status === 403) {
      setQuotaError(true);
      setMsg(data.error ?? t('seatQuotaExceeded'));
      return;
    }
    if (!res.ok) {
      setMsg(data.error ?? tc('failed'));
      return;
    }
    setModalOpen(false);
    setMsg(t('userCreated', { login: data.login }));
    await load();
  }

  const formId = 'create-user-form';

  return (
    <AppShell maxWidthClass="max-w-3xl">
      <PageHeader
        title={t('title')}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            {t('createUser')}
          </button>
        }
      />

      {quotaError && (
        <PageSection className="mb-4 border-rose-200 bg-rose-50 text-[13px] text-rose-800">
          {t('quotaExceeded')}
        </PageSection>
      )}

      <StatusMessage>{msg}</StatusMessage>

      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tAuth('login')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('name')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t('role')}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc('status')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS}>{u.login}</td>
                <td className={DATA_TABLE_TD_CLASS}>{u.fullName}</td>
                <td className={DATA_TABLE_TD_CLASS}>{u.role}</td>
                <td className={DATA_TABLE_TD_CLASS}>{u.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <EraModal
        open={modalOpen}
        title={t('createUser')}
        onClose={() => setModalOpen(false)}
        footer={
          <EraModalFooter formId={formId} onCancel={() => setModalOpen(false)} busy={busy} submitLabel={t('createUser')} />
        }
      >
        <form id={formId} onSubmit={createUser} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="user-login">
              {tAuth('login')}
            </label>
            <input
              id="user-login"
              className={MODAL_INPUT_CLASS}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="user-fullName">
              {t('fullName')}
            </label>
            <input
              id="user-fullName"
              className={MODAL_INPUT_CLASS}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="user-password">
              {tAuth('password')}
            </label>
            <input
              id="user-password"
              type="password"
              className={MODAL_INPUT_CLASS}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS} htmlFor="user-role">
              {t('role')}
            </label>
            <select
              id="user-role"
              className={MODAL_INPUT_CLASS}
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code}
                </option>
              ))}
            </select>
          </div>
        </form>
      </EraModal>
    </AppShell>
  );
}
