export interface DoorLockAdapter {
  unlockRoom(input: { roomNumber: string; reservationId: string }): Promise<{ ok: boolean; ref: string }>;
}

class MockDoorLockAdapter implements DoorLockAdapter {
  async unlockRoom(input: { roomNumber: string; reservationId: string }) {
    return { ok: true, ref: `MOCK-LOCK-${input.roomNumber}-${input.reservationId.slice(0, 6)}` };
  }
}

/** HTTP vendor bridge when ERA_DOOR_LOCK_URL is set. */
class HttpDoorLockAdapter implements DoorLockAdapter {
  async unlockRoom(input: { roomNumber: string; reservationId: string }) {
    const base = process.env.ERA_DOOR_LOCK_URL!.replace(/\/$/, '');
    const res = await fetch(`${base}/unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.ERA_DOOR_LOCK_TOKEN
          ? { Authorization: `Bearer ${process.env.ERA_DOOR_LOCK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Door lock unlock failed: ${res.status} ${text}`);
    }
    const json = (await res.json()) as { ref?: string; ok?: boolean };
    return { ok: json.ok ?? true, ref: json.ref ?? `HTTP-${input.roomNumber}` };
  }
}

export function getDoorLockAdapter(): DoorLockAdapter {
  const driver = (process.env.ERA_DOOR_LOCK_DRIVER ?? 'mock').trim().toLowerCase();
  if (driver === 'vendor' || driver === 'http') {
    if (process.env.ERA_DOOR_LOCK_URL?.trim()) {
      return new HttpDoorLockAdapter();
    }
  }
  return new MockDoorLockAdapter();
}
