export class IbeAuthError extends Error {
  status = 401;
  constructor(message: string) {
    super(message);
  }
}

export class IbeForbiddenError extends Error {
  status = 403;
  constructor(message: string) {
    super(message);
  }
}

export class IbeConflictError extends Error {
  status = 409;
  constructor(message: string) {
    super(message);
  }
}

export class IbeUnavailableError extends Error {
  status = 503;
  constructor(message: string) {
    super(message);
  }
}

/** Header-only — never query `?key=` (leaks into logs / Referer). */
export function parseIbePublishableKey(req: Request): string | null {
  const auth = req.headers.get('authorization')?.trim();
  if (auth?.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim() || null;
  }
  return null;
}

export function holdCoversNight(
  hold: { checkInDate: Date; checkOutDate: Date },
  nightIso: string,
): boolean {
  const night = new Date(`${nightIso}T00:00:00.000Z`);
  return hold.checkInDate <= night && hold.checkOutDate > night;
}

export function deductHoldsFromAvailable(physical: number, holdCount: number): number {
  return Math.max(0, physical - Math.max(0, holdCount));
}

export function ibeCorsHeaders(origins: string[], requestOrigin: string | null): HeadersInit {
  if (!requestOrigin || origins.includes('*') || !origins.includes(requestOrigin)) {
    return {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
      Vary: 'Origin',
    };
  }
  return {
    'Access-Control-Allow-Origin': requestOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
    Vary: 'Origin',
  };
}

export function ibePreflightHeaders(requestOrigin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
    Vary: 'Origin',
  };
  if (requestOrigin && /^https:\/\//i.test(requestOrigin)) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
  }
  return headers;
}
