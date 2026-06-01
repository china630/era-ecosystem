export interface DoorLockAdapter {
  unlockRoom(input: { roomNumber: string; reservationId: string }): Promise<{ ok: boolean; ref: string }>;
}

class MockDoorLockAdapter implements DoorLockAdapter {
  async unlockRoom(input: { roomNumber: string; reservationId: string }) {
    return { ok: true, ref: `MOCK-LOCK-${input.roomNumber}-${input.reservationId.slice(0, 6)}` };
  }
}

export function getDoorLockAdapter(): DoorLockAdapter {
  return new MockDoorLockAdapter();
}
