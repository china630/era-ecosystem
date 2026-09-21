import { describe, expect, it } from '@jest/globals';
import {
  IbeAuthError,
  IbeForbiddenError,
  ibeCorsHeaders,
} from '@/lib/channel/ibe-helpers';

describe('IBE public helpers (W5)', () => {
  it('builds CORS allowlist from org origins', () => {
    const headers = ibeCorsHeaders(
      ['https://hotel.example.com', 'https://www.hotel.example.com'],
      'https://hotel.example.com',
    ) as Record<string, string>;
    expect(headers['Access-Control-Allow-Origin']).toBe('https://hotel.example.com');
  });

  it('exposes auth/forbidden error status codes for negative paths', () => {
    expect(new IbeAuthError('bad key').status).toBe(401);
    expect(new IbeForbiddenError('origin').status).toBe(403);
  });
});
