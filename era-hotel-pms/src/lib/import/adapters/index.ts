import { agencyStatementAdapter } from '@/lib/import/adapters/agency-statement.adapter';
import { barBootstrapAdapter } from '@/lib/import/adapters/bar-bootstrap.adapter';
import { agenciesAdapter } from '@/lib/import/adapters/agencies.adapter';
import { bedTypesAdapter } from '@/lib/import/adapters/bed-types.adapter';
import { foliosAdapter } from '@/lib/import/adapters/folios.adapter';
import { guestsAdapter } from '@/lib/import/adapters/guests.adapter';
import { productCardsAdapter, stockCardsAdapter } from '@/lib/import/adapters/products.adapter';
import { packageSellAdapter } from '@/lib/import/adapters/package-sell.adapter';
import { ratePlansAdapter } from '@/lib/import/adapters/rate-plans.adapter';
import { reservationsAdapter } from '@/lib/import/adapters/reservations.adapter';
import { reservationNotesAdapter } from '@/lib/import/adapters/reservation-notes.adapter';
import { revenueCodesAdapter } from '@/lib/import/adapters/revenue-codes.adapter';
import { roomTypesAdapter } from '@/lib/import/adapters/room-types.adapter';
import { roomViewsAdapter } from '@/lib/import/adapters/room-views.adapter';
import { roomsAdapter } from '@/lib/import/adapters/rooms.adapter';
import type { ImportAdapter, ImportEntityMeta } from '@/lib/import/types';

const ADAPTERS = [
  revenueCodesAdapter,
  bedTypesAdapter,
  roomViewsAdapter,
  roomTypesAdapter,
  barBootstrapAdapter,
  ratePlansAdapter,
  packageSellAdapter,
  roomsAdapter,
  agenciesAdapter,
  productCardsAdapter,
  stockCardsAdapter,
  guestsAdapter,
  reservationsAdapter,
  reservationNotesAdapter,
  foliosAdapter,
  agencyStatementAdapter,
] as ImportAdapter<unknown>[];

const byEntity = new Map(ADAPTERS.map((a) => [a.entity, a]));

export function getImportAdapter(entity: string): ImportAdapter<unknown> | undefined {
  return byEntity.get(entity);
}

export function listImportEntities(): ImportEntityMeta[] {
  return ADAPTERS.map(({ entity, label, order, templateHint, fileless, allowMultiple }) => ({
    entity,
    label,
    order,
    templateHint,
    fileless,
    allowMultiple,
  })).sort((a, b) => a.order - b.order);
}

export {
  revenueCodesAdapter,
  bedTypesAdapter,
  roomViewsAdapter,
  roomTypesAdapter,
  barBootstrapAdapter,
  ratePlansAdapter,
  packageSellAdapter,
  roomsAdapter,
  agenciesAdapter,
  productCardsAdapter,
  stockCardsAdapter,
  guestsAdapter,
  reservationsAdapter,
  reservationNotesAdapter,
  foliosAdapter,
  agencyStatementAdapter,
};
