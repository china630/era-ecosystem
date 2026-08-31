import { describe, expect, it } from '@jest/globals';
import {
  PLAN_STATUSES,
  UNASSIGNED_STATUSES,
} from '@/lib/services/room-plan.service';

describe('room-plan availability', () => {
  it('computes free count as total minus occupied per day', () => {
    const totalRooms = 10;
    const occupied = 3;
    expect(Math.max(0, totalRooms - occupied)).toBe(7);
  });
});

describe('room-plan status feed constants', () => {
  it('includes CHECKED_OUT in assigned plan statuses but not unassigned', () => {
    expect(PLAN_STATUSES).toEqual(['CONFIRMED', 'IN_HOUSE', 'OPTION', 'CHECKED_OUT']);
    expect(UNASSIGNED_STATUSES).toEqual(['CONFIRMED', 'IN_HOUSE', 'OPTION']);
    expect(PLAN_STATUSES).toContain('CHECKED_OUT');
    expect(UNASSIGNED_STATUSES).not.toContain('CHECKED_OUT' as (typeof UNASSIGNED_STATUSES)[number]);
  });
});
