'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@era/satellite-kit/ui';
import AppShell, { PageSection } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Summary = {
  totalGuests: number;
  withoutGlobalPersonId: number;
  withoutMdmLink: number;
  suspectedDuplicateGroups: number;
  suspectedDuplicateGuests: number;
};

type Group = {
  key: string;
  matchType: string;
  guestIds: string[];
  labels: string[];
};

export default function GuestDedupReportPage() {
  const { can } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    void fetch('/api/admin/guest-dedup/summary')
      .then((r) => r.json())
      .then((d) => {
        setSummary(d.summary);
        setGroups(d.groups ?? []);
      });
  }, []);

  if (!can(PERMISSIONS.REPORTS_READ)) {
    return (
      <AppShell>
        <p className="text-[13px] text-[#7F8C8D]">Reports permission required.</p>
      </AppShell>
    );
  }

  return (
    <AppShell maxWidthClass="max-w-4xl">
      <PageHeader
        title="Guest deduplication"
        leading={
          <Link href="/reports/analytics" className="text-[13px] text-[#2980B9] hover:underline">
            Analytics
          </Link>
        }
      />
      {summary && (
        <PageSection className="mb-4 grid grid-cols-2 gap-3 text-[13px] md:grid-cols-3">
          <div>Total guests: <strong>{summary.totalGuests}</strong></div>
          <div>Without globalPersonId: <strong>{summary.withoutGlobalPersonId}</strong></div>
          <div>Without MDM link: <strong>{summary.withoutMdmLink}</strong></div>
          <div>Duplicate groups: <strong>{summary.suspectedDuplicateGroups}</strong></div>
          <div>Guests in dup groups: <strong>{summary.suspectedDuplicateGuests}</strong></div>
        </PageSection>
      )}
      <PageSection>
        <h2 className="mb-2 font-semibold text-[#34495E]">Suspected duplicates</h2>
        <ul className="space-y-2 text-[13px]">
          {groups.map((g) => (
            <li key={`${g.matchType}-${g.key}`} className="rounded border border-[#ECEFF1] p-2">
              <span className="font-medium">{g.matchType}</span> {g.key} — {g.labels.join(', ')}
            </li>
          ))}
          {groups.length === 0 && <li className="text-[#7F8C8D]">No duplicate groups detected.</li>}
        </ul>
        <p className="mt-4 text-[12px] text-[#7F8C8D]">
          See <code>doc/NAFTA-GUEST-INTELLIGENCE.md</code> for merge workflow via orchestrator MDM.
        </p>
      </PageSection>
    </AppShell>
  );
}
