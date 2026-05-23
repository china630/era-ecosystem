import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleRouteError(err: unknown) {
  if (err instanceof ZodError) {
    return jsonError(err.errors.map((e) => e.message).join('; '), 400);
  }
  if (err instanceof Error) {
    const lower = err.message.toLowerCase();
    if (lower.includes('unauthorized')) {
      return jsonError(err.message, 401);
    }
    if (lower.includes('forbidden') || lower.includes('insufficient permissions')) {
      return jsonError(err.message, 403);
    }
    if (lower.includes('idempotency conflict')) {
      return jsonError(err.message, 409);
    }
    const known = ['not found', 'invalid', 'cannot', 'only', 'must'];
    if (known.some((k) => lower.includes(k))) {
      return jsonError(err.message, 400);
    }
    console.error(err);
    return jsonError(err.message, 500);
  }
  console.error(err);
  return jsonError('Internal server error', 500);
}
