import { describe, expect, it } from '@jest/globals';
import { listChannelAdapterCodes } from '@/lib/channel/adapters/registry';

describe('channel adapter registry (W1 binding SoR)', () => {
  it('lists production providers without legacy env adapters as primary codes', () => {
    expect(listChannelAdapterCodes()).toEqual(['off', 'stub', 'webhook', 'channex']);
  });
});
