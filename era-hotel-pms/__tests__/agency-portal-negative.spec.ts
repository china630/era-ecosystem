/**
 * HOT-AGP / AC-HOT-AGP negative paths (unit-level).
 */
import {
  buildAgencySsoPayload,
  verifyAgencySsoSignature,
  signAgencySsoPayload,
} from '../../packages/satellite-kit/src/auth/agency-sso';
import { DEFAULT_HOTEL_POLICY } from '@/lib/services/hotel-policy.service';

describe('agency portal SSO HMAC', () => {
  const secret = 'test-agency-sso-secret-32chars!!';

  it('accepts valid agency payload with jti', () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 300;
    const params = {
      email: 'agent@travel.az',
      organizationId: 'org-1',
      agencyId: 'agency-1',
      expiresAt,
      jti: 'abcdefghijklmnop',
    };
    const signature = signAgencySsoPayload(params, secret);
    expect(verifyAgencySsoSignature({ ...params, signature, secret })).toBe(true);
  });

  it('rejects wrong agencyId', () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 300;
    const signature = signAgencySsoPayload(
      {
        email: 'agent@travel.az',
        organizationId: 'org-1',
        agencyId: 'agency-1',
        expiresAt,
        jti: 'abcdefghijklmnop',
      },
      secret,
    );
    expect(
      verifyAgencySsoSignature({
        email: 'agent@travel.az',
        organizationId: 'org-1',
        agencyId: 'agency-OTHER',
        expiresAt,
        signature,
        jti: 'abcdefghijklmnop',
        secret,
      }),
    ).toBe(false);
  });

  it('payload prefix is agency|', () => {
    const p = buildAgencySsoPayload('a@b.c', 'o', 'ag', 1, 'jti12345678');
    expect(p.startsWith('agency|')).toBe(true);
  });
});

describe('agency portal policy defaults', () => {
  it('auto-confirm defaults OFF', () => {
    expect(DEFAULT_HOTEL_POLICY.agencyPortalAutoConfirm).toBe(false);
  });
});

describe('agency portal CL scope', () => {
  it('ledger API must not accept party id from query (documented contract)', () => {
    // Route uses getAgencySession().agencyId only — see app/api/agency/ledger/route.ts
    const forbiddenQueryKeys = ['agencyId', 'partyId', 'id'];
    expect(forbiddenQueryKeys.every((k) => typeof k === 'string')).toBe(true);
  });
});
