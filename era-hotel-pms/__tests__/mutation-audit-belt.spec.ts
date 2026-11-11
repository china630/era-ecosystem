import {
  HTTP_MUTATION_ENTITY_TYPE,
  isMutationAuditExemptPath,
} from '@era/satellite-kit';

const HOTEL_REFRESH_EXEMPT = ['/api/auth/session/refresh-permissions'] as const;

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
        HOTEL_REFRESH_EXEMPT,
      ),
    ).toBe(true);
    expect(isMutationAuditExemptPath('/api/reservations', HOTEL_REFRESH_EXEMPT)).toBe(false);
    expect(isMutationAuditExemptPath('/api/outlets/select', HOTEL_REFRESH_EXEMPT)).toBe(false);
  });
});
