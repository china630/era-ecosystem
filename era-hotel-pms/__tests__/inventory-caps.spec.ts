import { houseSellCap, sellableOnNight, typeSellCap, worstNight } from '../src/lib/services/inventory-caps';

describe('inventory caps', () => {
  it('keeps today when both allowances are zero', () => {
    expect(typeSellCap(20, 0, false)).toBe(20);
    expect(houseSellCap(30, 0)).toBe(30);
    expect(
      sellableOnNight({ typeUsed: 20, typeCap: 20, houseUsed: 20, houseCap: 30, stopSell: false }).reason,
    ).toBe('TYPE_CAP');
  });

  it('lets a type go above its doors only inside the house cap', () => {
    const typeCap = typeSellCap(20, 3, false);
    const houseCap = houseSellCap(30, 0);
    expect(
      sellableOnNight({ typeUsed: 22, typeCap, houseUsed: 28, houseCap, stopSell: false }).available,
    ).toBe(1);
    expect(
      sellableOnNight({ typeUsed: 22, typeCap, houseUsed: 30, houseCap, stopSell: false }).reason,
    ).toBe('HOUSE_CAP');
  });

  it('stop-sell beats a type allowance', () => {
    const sell = sellableOnNight({
      typeUsed: 0,
      typeCap: typeSellCap(20, 3, true),
      houseUsed: 0,
      houseCap: houseSellCap(30, 2),
      stopSell: true,
    });
    expect(sell).toEqual({ available: 0, reason: 'STOP_SELL' });
  });

  it('picks stop-sell over a tighter house night when remainders match', () => {
    const worst = worstNight([
      { available: 0, reason: 'HOUSE_CAP' as const },
      { available: 0, reason: 'STOP_SELL' as const },
    ]);
    expect(worst?.reason).toBe('STOP_SELL');
  });
});
