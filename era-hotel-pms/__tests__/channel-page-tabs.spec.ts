import { parseChannelPageTab } from '@/components/channel/types';

describe('parseChannelPageTab', () => {
  it('accepts known tabs', () => {
    expect(parseChannelPageTab('channels')).toBe('channels');
    expect(parseChannelPageTab('inventory')).toBe('inventory');
    expect(parseChannelPageTab('journal')).toBe('journal');
    expect(parseChannelPageTab('overview')).toBe('overview');
  });

  it('defaults unknown or empty to overview', () => {
    expect(parseChannelPageTab(null)).toBe('overview');
    expect(parseChannelPageTab(undefined)).toBe('overview');
    expect(parseChannelPageTab('nope')).toBe('overview');
  });
});
