import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..');

describe('channel manager tenant isolation contracts', () => {
  it('property and IBE key lookup skip the ALS tenant filter', () => {
    const src = readFileSync(
      join(root, 'src/lib/channel/channel-manager-binding.service.ts'),
      'utf8',
    );
    expect(src).toContain('skipTenantFilter: true');
    expect(src).toContain('channexPropertyId');
    expect(src).toContain('ibePublishableKey');
  });

  it('Channex webhook enters request tenant only after property bind', () => {
    const src = readFileSync(
      join(root, 'app/api/integrations/channex/webhook/route.ts'),
      'utf8',
    );
    expect(src.indexOf('getChannelManagerBindingByPropertyId')).toBeGreaterThan(-1);
    expect(src.indexOf('enterRequestTenant')).toBeGreaterThan(
      src.indexOf('getChannelManagerBindingByPropertyId'),
    );
    expect(src).toContain('fetchBookingRevision');
    expect(src).toContain('ackBookingRevision');
  });
});
