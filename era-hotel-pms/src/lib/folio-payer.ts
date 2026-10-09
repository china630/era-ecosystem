/** Who a walk-up payment names, and which open folio receives it. */

export type PayerGuest = {
  id: string;
  name: string;
  isPrimary: boolean;
  ownsFolio?: boolean;
};

export type PayerResolution =
  | { kind: 'none' }
  | { kind: 'fixed'; guest: PayerGuest }
  | { kind: 'pick' };

export type FolioParty = 'guest' | 'agency' | 'company';

export function resolvePayer(guests: PayerGuest[]): PayerResolution {
  const named = guests.filter((g) => g.name.trim());
  if (named.length === 0) return { kind: 'none' };
  if (named.length === 1) return { kind: 'fixed', guest: named[0]! };
  const primary = named.find((g) => g.isPrimary);
  if (primary) return { kind: 'fixed', guest: primary };
  return { kind: 'pick' };
}

export function pickTargetFolio<
  T extends { type: string; status: string; reservationGuestId?: string | null },
>(folios: T[], party: FolioParty, guest?: PayerGuest | null): T | undefined {
  const open = folios.filter((f) => f.status === 'OPEN');
  if (party === 'agency') return open.find((f) => f.type === 'AGENCY');
  if (party === 'company') return open.find((f) => f.type === 'COMPANY');
  if (guest?.ownsFolio) {
    const own = open.find((f) => f.type === 'GUEST' && f.reservationGuestId === guest.id);
    if (own) return own;
  }
  return (
    open.find((f) => f.type === 'GUEST' && !f.reservationGuestId) ??
    open.find((f) => f.type === 'GUEST')
  );
}

export function accountBalance(folio: {
  charges: Array<{ amount: number | string; qty?: number | null }>;
  payments?: Array<{ amount: number | string; kind?: string | null }>;
}): number {
  const charges = folio.charges.reduce(
    (s, c) => s + Number(c.amount) * (c.qty == null ? 1 : Number(c.qty)),
    0,
  );
  const payments = (folio.payments ?? []).reduce((s, p) => {
    const n = Number(p.amount);
    return s + (p.kind === 'REFUND' ? -n : n);
  }, 0);
  return Math.round((charges - payments) * 100) / 100;
}
