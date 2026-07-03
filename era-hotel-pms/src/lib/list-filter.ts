/** Client-side list filter for master-data tables (code / name / room number). */

export function matchesCodeNameQuery(
  row: {
    code?: string | null;
    name?: string | null;
    roomNumber?: string | null;
    fullName?: string | null;
    phone?: string | null;
    globalPersonId?: string | null;
    voen?: string | null;
  },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    row.code,
    row.name,
    row.roomNumber,
    row.fullName,
    row.phone,
    row.globalPersonId,
    row.voen,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

export function matchesRoomTypeFilter(
  row: { roomType?: { code?: string } | null; roomTypeId?: string },
  roomTypeId: string,
): boolean {
  if (!roomTypeId) return true;
  if (row.roomTypeId) return row.roomTypeId === roomTypeId;
  return row.roomType?.code === roomTypeId;
}

export function matchesProductType(
  row: { productType?: string | null },
  productType: string,
): boolean {
  if (!productType) return true;
  return row.productType === productType;
}

export function matchesActiveFilter(row: { active?: boolean }, activeFilter: string): boolean {
  if (!activeFilter || activeFilter === 'ALL') return true;
  if (activeFilter === 'ACTIVE') return row.active === true;
  if (activeFilter === 'INACTIVE') return row.active === false;
  return true;
}
