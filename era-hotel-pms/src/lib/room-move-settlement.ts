export const CLASS_SETTLEMENTS = ['HOTEL', 'GUEST_PAY', 'HOTEL_REFUND', 'GUEST_CHEAPER'] as const;
export type ClassSettlement = (typeof CLASS_SETTLEMENTS)[number];

export function isClassSettlement(value: unknown): value is ClassSettlement {
  return typeof value === 'string' && (CLASS_SETTLEMENTS as readonly string[]).includes(value);
}

/** Door class differs from both the charged type and the already-given type. */
export function doorTypeNeedsSettlement(
  chargedRoomTypeId: string | null | undefined,
  givenRoomTypeId: string | null | undefined,
  doorRoomTypeId: string | null | undefined,
): boolean {
  if (!chargedRoomTypeId || !doorRoomTypeId) return false;
  if (doorRoomTypeId === chargedRoomTypeId) return false;
  if (givenRoomTypeId && doorRoomTypeId === givenRoomTypeId) return false;
  return true;
}

export function settlementNote(settlement: ClassSettlement): string {
  return `settlement:${settlement}`;
}

export function readSettlement(notes: string | null | undefined): ClassSettlement | null {
  const match = notes?.match(/settlement:(HOTEL|GUEST_PAY|HOTEL_REFUND|GUEST_CHEAPER)/);
  return match && isClassSettlement(match[1]) ? match[1] : null;
}
