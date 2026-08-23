import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { IndustryModuleInactiveError } from '@era/satellite-kit';
import { GuestMdmRequiredError } from '@/lib/guest-identity';
import { LaundryOpenError } from '@/lib/services/hk-nafta.service';
import { TourConflictError } from '@/lib/services/tour.service';

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
  if (err instanceof IndustryModuleInactiveError) {
    return jsonError(err.message, 403);
  }
  if (err instanceof GuestMdmRequiredError) {
    return jsonError(err.message, 400);
  }
  if (err instanceof LaundryOpenError) {
    return NextResponse.json(
      { error: err.message, code: err.code, tickets: err.tickets },
      { status: 409 },
    );
  }
  if (err instanceof TourConflictError) {
    return jsonError(err.message, 409);
  }
  if (err instanceof Error) {
    const status = (err as Error & { status?: number }).status;
    const lower = err.message.toLowerCase();
    if (typeof status === 'number' && status >= 400 && status < 600) {
      return jsonError(err.message, status);
    }
    if (lower.includes('unauthorized')) {
      return jsonError(err.message, 401);
    }
    if (lower.includes('forbidden') || lower.includes('insufficient permissions')) {
      return jsonError(err.message, 403);
    }
    if (lower.includes('idempotency conflict') || lower.includes('duplicate') || lower.includes('no contract allotment') || lower.includes('no availability')) {
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
