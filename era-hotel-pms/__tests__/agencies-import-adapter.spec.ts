import { firstCellString, mapHeaders } from '@/lib/import/helpers';
import { agenciesAdapter } from '@/lib/import/adapters/agencies.adapter';

describe('agencies import adapter', () => {
  it('maps EW Agent Code / Full Name', () => {
    const mapped = mapHeaders(
      { 'Agent Code': 'ABV MMC leisure', 'Full Name': 'ABV', Passive: null, 'Grey List': 'false' },
      agenciesAdapter.headerAliases,
    );
    const row = agenciesAdapter.mapRow(mapped);
    expect(row).toMatchObject({
      code: 'ABV MMC LEISURE',
      name: 'ABV',
      active: true,
    });
    expect(agenciesAdapter.rowSchema.parse(row).code).toBe('ABV MMC LEISURE');
  });

  it('reads original Excel headers even if aliases are empty', () => {
    const mapped = mapHeaders(
      { 'Agent Code': '1001 kurort medical', 'Full Name': '1001 kurort' },
      {},
    );
    expect(mapped['Agent Code']).toBe('1001 kurort medical');
    const row = agenciesAdapter.mapRow(mapped);
    expect(row).toMatchObject({ code: '1001 KURORT MEDICAL', name: '1001 kurort' });
  });

  it('skips footer rows with no identity', () => {
    expect(agenciesAdapter.mapRow({ 'Grey List': 'false', 'Rate Code': 'Daily rates' })).toBeNull();
  });

  it('firstCellString matches headers case-insensitively', () => {
    expect(firstCellString({ 'agent code': 'X' }, ['Agent Code'])).toBe('X');
  });
});
