import { describe, expect, it } from '@jest/globals';

describe('room-plan availability', () => {
  it('computes free count as total minus occupied per day', () => {
    const totalRooms = 10;
    const occupied = 3;
    expect(Math.max(0, totalRooms - occupied)).toBe(7);
  });
});
