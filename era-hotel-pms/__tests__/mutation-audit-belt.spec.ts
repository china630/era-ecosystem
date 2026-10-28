import {
  HTTP_MUTATION_ENTITY_TYPE,
  isMutationAuditExemptPath,
} from '@era/satellite-kit';
import { HOTEL_MUTATION_AUDIT_EXEMPT_PREFIXES } from '@/lib/mutation-audit-belt';

describe('hotel mutation audit belt', () => {
  it('exports HTTP_MUTATION entity type', () => {
    expect(HTTP_MUTATION_ENTITY_TYPE).toBe('HTTP_MUTATION');
  });

  it('exempts auth login, locale, and hotel refresh-permissions', () => {
    expect(isMutationAuditExemptPath('/api/auth/login')).toBe(true);
    expect(isMutationAuditExemptPath('/api/locale')).toBe(true);
    expect(
      isMutationAuditExemptPath(
        '/api/auth/session/refresh-permissions',
        HOTEL_MUTATION_AUDIT_EXEMPT_PREFIXES,
      ),
    ).toBe(true);
    expect(
      isMutationAuditExemptPath('/api/reservations', HOTEL_MUTATION_AUDIT_EXEMPT_PREFIXES),
    ).toBe(false);
    expect(
      isMutationAuditExemptPath('/api/outlets/select', HOTEL_MUTATION_AUDIT_EXEMPT_PREFIXES),
    ).toBe(false);
  });
});
