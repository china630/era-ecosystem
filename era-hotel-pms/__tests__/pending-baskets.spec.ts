import { collapsePendingBaskets } from '@/lib/pending-baskets';

describe('pending cashier baskets', () => {
  const lone = {
    id: 'a',
    basketRef: null,
    amount: 10,
    description: 'Single',
    payerLabel: null,
    currency: 'AZN',
  };
  const left = {
    id: 'b',
    basketRef: '20261022-001',
    amount: 20,
    description: 'Naftalan',
    payerLabel: 'Chinese group',
    currency: 'AZN',
  };
  const right = {
    id: 'c',
    basketRef: '20261022-001',
    amount: '15.50',
    description: 'CBC',
    payerLabel: 'Chinese group',
    currency: 'AZN',
  };

  it('keeps a charge without a basket as its own row', () => {
    const [row] = collapsePendingBaskets([lone]);
    expect(row?.id).toBe('a');
    expect(row?.basketCount).toBe(1);
    expect(row?.members).toHaveLength(1);
  });

  it('collapses one basket into a single total', () => {
    const rows = collapsePendingBaskets([lone, left, right]);
    expect(rows).toHaveLength(2);
    const basket = rows.find((row) => row.basketCount > 1);
    expect(basket?.id).toBe('basket:20261022-001');
    expect(basket?.description).toBe('Chinese group');
    expect(Number(basket?.amount)).toBeCloseTo(35.5);
    expect(basket?.members.map((member) => member.id)).toEqual(['b', 'c']);
  });
});
