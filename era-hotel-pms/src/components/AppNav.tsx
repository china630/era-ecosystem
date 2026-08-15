'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function AppNav() {
  const { user, can } = useAuth();
  const t = useTranslations('nav');

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <nav className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 pb-4 text-sm">
      <div className="flex flex-wrap gap-4">
        <Link href="/fo/rack" className="text-sky-400 hover:underline">
          {t('chessboard')}
        </Link>
        {can(PERMISSIONS.RESERVATIONS_READ) && (
          <Link href="/fo/room-plan" className="text-sky-400 hover:underline">
            {t('roomPlan')}
          </Link>
        )}
        {can(PERMISSIONS.RESERVATIONS_WRITE) && (
          <Link href="/bookings/new" className="text-sky-400 hover:underline">
            {t('roomBooking')}
          </Link>
        )}
        {can(PERMISSIONS.REPORTS_READ) && (
          <>
            <Link href="/reports/occupancy" className="text-sky-400 hover:underline">
              {t('occupancy')}
            </Link>
            <Link href="/front-cash/agency-ledger" className="text-sky-400 hover:underline">
              {t('agencyLedger')}
            </Link>
            <Link href="/reports/reconciliation" className="text-sky-400 hover:underline">
              {t('reconciliation')}
            </Link>
          </>
        )}
        {can(PERMISSIONS.RESERVATIONS_READ) && (
          <a
            href={
              process.env.NEXT_PUBLIC_FNB_POS_URL ??
              process.env.NEXT_PUBLIC_FB_POS_URL ??
              'http://localhost:3202'
            }
            className="text-sky-400 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('posCalendar')}
          </a>
        )}
        {can(PERMISSIONS.MASTER_DATA_MANAGE) && (
          <>
            <Link href="/settings/master-data" className="text-sky-400 hover:underline">
              {t('masterData')}
            </Link>
            <Link href="/settings/integration" className="text-sky-400 hover:underline">
              {t('integration')}
            </Link>
            <Link href="/settings/stock" className="text-sky-400 hover:underline">
              {t('stock')}
            </Link>
          </>
        )}
        {can(PERMISSIONS.USERS_MANAGE) && (
          <Link href="/settings/users" className="text-sky-400 hover:underline">
            {t('users')}
          </Link>
        )}
        {(can(PERMISSIONS.HOUSEKEEPING_MANAGE) || can(PERMISSIONS.ROOMS_STATUS)) && (
          <Link href="/hk" className="text-sky-400 hover:underline">
            {t('housekeeping')}
          </Link>
        )}
        {can(PERMISSIONS.CHANNEL_MANAGE) && (
          <Link href="/distribution/channel" className="text-sky-400 hover:underline">
            {t('channel')}
          </Link>
        )}
        {can(PERMISSIONS.MEDICAL_MANAGE) && (
          <Link href="/medical" className="text-sky-400 hover:underline">
            {t('medical')}
          </Link>
        )}
        {(can(PERMISSIONS.NIGHT_AUDIT_RUN) || can(PERMISSIONS.RESERVATIONS_CANCEL)) && (
          <Link href="/night-audit" className="text-sky-400 hover:underline">
            {t('operations')}
          </Link>
        )}
      </div>
      <div className="flex items-center gap-3 text-slate-400">
        <LanguageSwitcher />
        {user && (
          <span>
            {user.fullName} <span className="text-slate-500">({user.role})</span>
          </span>
        )}
        <button
          type="button"
          onClick={logout}
          className="rounded border border-slate-600 px-2 py-1 text-xs hover:bg-slate-800"
        >
          {t('logout')}
        </button>
      </div>
    </nav>
  );
}
