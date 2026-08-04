'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CatalogOption } from '@era/satellite-kit/ui';

export type HotelLookupKindCode =
  | 'MARKET'
  | 'SEGMENT'
  | 'VIP_TYPE'
  | 'LOYALTY_TIER'
  | 'VISA_TYPE'
  | 'TITLE'
  | 'GENDER'
  | 'MARITAL_STATUS'
  | 'TRIP_REASON'
  | 'ACCOM_TYPE'
  | 'RECORD_TYPE'
  | 'SPECIAL_STATE'
  | 'VERIFICATION_STATUS'
  | 'NOTE_TYPE'
  | 'CONCIERGE_CATEGORY'
  | 'EVENT_LINE_KIND';

type LookupRow = { code: string; name: string; active?: boolean };

/** Load active HotelLookup rows for FO/guest CatalogField options. */
export function useHotelLookupOptions(kinds: HotelLookupKindCode[]) {
  const [byKind, setByKind] = useState<Partial<Record<HotelLookupKindCode, CatalogOption[]>>>({});
  const [roomViews, setRoomViews] = useState<CatalogOption[]>([]);
  const [bedTypes, setBedTypes] = useState<CatalogOption[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const kindFetches = kinds.map(async (kind) => {
        const res = await fetch(`/api/master/lookups?kind=${kind}&activeOnly=1`);
        const data = (await res.json()) as LookupRow[] | { error?: string };
        const rows = Array.isArray(data) ? data : [];
        return [
          kind,
          rows.map((r) => ({ value: r.code, label: r.name || r.code })),
        ] as const;
      });
      const [kindEntries, viewsRes, bedsRes] = await Promise.all([
        Promise.all(kindFetches),
        fetch('/api/master/room-views').then((r) => r.json()),
        fetch('/api/master/bed-types').then((r) => r.json()),
      ]);
      const next: Partial<Record<HotelLookupKindCode, CatalogOption[]>> = {};
      for (const [kind, opts] of kindEntries) next[kind] = opts;
      setByKind(next);
      const views = Array.isArray(viewsRes) ? viewsRes : [];
      const beds = Array.isArray(bedsRes) ? bedsRes : [];
      setRoomViews(
        views
          .filter((v: LookupRow & { active?: boolean }) => v.active !== false)
          .map((v: LookupRow) => ({ value: v.code, label: v.name || v.code })),
      );
      setBedTypes(
        beds
          .filter((b: LookupRow & { active?: boolean }) => b.active !== false)
          .map((b: LookupRow) => ({ value: b.code, label: b.name || b.code })),
      );
    } finally {
      setLoading(false);
    }
  }, [kinds.join('|')]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { byKind, roomViews, bedTypes, loading, reload };
}

/** Ensure current free-text value remains selectable until catalog is cleaned. */
export function withOrphanOption(options: CatalogOption[], value: string): CatalogOption[] {
  if (!value) return options;
  if (options.some((o) => o.value === value)) return options;
  return [...options, { value, label: value }];
}
