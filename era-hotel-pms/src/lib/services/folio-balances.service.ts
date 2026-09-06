import { prisma } from '@/lib/prisma';
import { folioBalance } from '@/lib/services/folio.service';
import { decimalToNumber } from '@/lib/decimal';

export type FolioBalanceTab =
  | 'inHouse'
  | 'inHouseBalanced'
  | 'inHouseGuestBalanced'
  | 'reservation';

export type FolioBalanceRow = {
  id: string;
  resNo: string | null;
  status: string;
  roomNumber: string | null;
  guestName: string;
  agencyName: string | null;
  companyName: string | null;
  checkInDate: string;
  checkOutDate: string;
  guestBalance: number;
  agencyBalance: number;
  companyBalance: number;
  roomCharges: number;
  extraCharges: number;
  firstGuestBalance: number | null;
  secondGuestBalance: number | null;
};

export function passesFolioBalanceTab(
  tab: FolioBalanceTab,
  guestBalance: number,
  agencyBalance: number,
  companyBalance: number,
): boolean {
  const absSum = Math.abs(guestBalance) + Math.abs(agencyBalance) + Math.abs(companyBalance);
  if (tab === 'inHouseBalanced' && absSum <= 0.01) return false;
  if (tab === 'inHouseGuestBalanced' && Math.abs(guestBalance) <= 0.01) return false;
  return true;
}

function isRoomRevenue(code: string | undefined): boolean {
  const c = (code ?? '').toUpperCase();
  return c === 'ROOM' || c === 'LODGING' || c.startsWith('ROOM');
}

export async function listReservationFolioBalances(tab: FolioBalanceTab): Promise<{
  tab: FolioBalanceTab;
  rows: FolioBalanceRow[];
}> {
  const statusFilter =
    tab === 'reservation'
      ? { in: ['CONFIRMED', 'OPTION', 'IN_HOUSE'] as const }
      : { in: ['IN_HOUSE'] as const };

  const reservations = await prisma.reservation.findMany({
    where: { status: statusFilter },
    include: {
      guest: { select: { fullName: true } },
      agency: { select: { name: true, code: true } },
      company: { select: { name: true, code: true } },
      room: { select: { roomNumber: true } },
      folios: {
        include: {
          charges: { include: { revenueCode: { select: { code: true } } } },
          payments: true,
          reservationGuest: { select: { firstName: true, lastName: true, sortOrder: true } },
        },
      },
    },
    orderBy: [{ room: { roomNumber: 'asc' } }, { checkInDate: 'asc' }],
    take: 500,
  });

  const rows: FolioBalanceRow[] = [];
  for (const r of reservations) {
    let guestBalance = 0;
    let agencyBalance = 0;
    let companyBalance = 0;
    let roomCharges = 0;
    let extraCharges = 0;
    const personal: { sort: number; bal: number }[] = [];

    for (const f of r.folios) {
      const bal = folioBalance(f.charges, f.payments);
      if (f.type === 'GUEST') guestBalance += bal;
      else if (f.type === 'AGENCY') agencyBalance += bal;
      else if (f.type === 'COMPANY') companyBalance += bal;
      for (const c of f.charges) {
        const amt = decimalToNumber(c.amount) * c.qty;
        if (isRoomRevenue(c.revenueCode?.code)) roomCharges += amt;
        else extraCharges += amt;
      }
      if (f.type === 'GUEST' && f.reservationGuest) {
        personal.push({ sort: f.reservationGuest.sortOrder ?? 0, bal });
      }
    }
    personal.sort((a, b) => a.sort - b.sort);

    if (!passesFolioBalanceTab(tab, guestBalance, agencyBalance, companyBalance)) continue;

    rows.push({
      id: r.id,
      resNo: r.resNo,
      status: r.status,
      roomNumber: r.room?.roomNumber ?? null,
      guestName: r.guest.fullName,
      agencyName: r.agency ? `${r.agency.code} ${r.agency.name}` : null,
      companyName: r.company ? `${r.company.code} ${r.company.name}` : null,
      checkInDate: r.checkInDate.toISOString(),
      checkOutDate: r.checkOutDate.toISOString(),
      guestBalance: Math.round(guestBalance * 100) / 100,
      agencyBalance: Math.round(agencyBalance * 100) / 100,
      companyBalance: Math.round(companyBalance * 100) / 100,
      roomCharges: Math.round(roomCharges * 100) / 100,
      extraCharges: Math.round(extraCharges * 100) / 100,
      firstGuestBalance: personal[0] ? Math.round(personal[0].bal * 100) / 100 : null,
      secondGuestBalance: personal[1] ? Math.round(personal[1].bal * 100) / 100 : null,
    });
  }

  return { tab, rows };
}
