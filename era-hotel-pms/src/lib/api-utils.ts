import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { IndustryModuleInactiveError } from '@era/satellite-kit';
import { isSatelliteBillingBlockedError } from '@era/satellite-kit/billing/gate';
import { GuestMdmRequiredError } from '@/lib/guest-identity';
import {
  GuestIdentityRequiredError,
  StayCheckInBlockedError,
} from '@/lib/guest-stay-requirements';
import { OccupiedHkLockedError } from '@/lib/occupied-hk-lock';
import { RoomTypeSettlementRequiredError } from '@/lib/services/room-move-request.service';
import { LaundryOpenError } from '@/lib/services/hk-nafta.service';
import { TourConflictError } from '@/lib/services/tour.service';
import { BusinessDateLagError } from '@/lib/business-date-lag';
export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export type RouteErrorResult = { status: number; body: Record<string, unknown> };

export function describeRouteError(err: unknown): RouteErrorResult {
  if (isSatelliteBillingBlockedError(err)) {
    return {
      status: err.status,
      body: { error: err.message, code: err.code, billingStatus: err.billingStatus },
    };
  }
  if (err instanceof ZodError) {
    return { status: 400, body: { error: err.errors.map((e) => e.message).join('; ') } };
  }
  if (err instanceof IndustryModuleInactiveError) {
    return { status: 403, body: { error: err.message } };
  }
  if (err instanceof Error && err.name === 'SatelliteChannelDisabledError') {
    const code = 'code' in err && typeof err.code === 'string' ? err.code : 'CHANNEL_DISABLED';
    return { status: 403, body: { error: err.message, code } };
  }
  if (err instanceof Error && err.name === 'FiscalError') {
    return { status: 400, body: { error: err.message } };
  }
  if (err instanceof Error && err.name === 'FxRateNotFoundError') {
    return { status: 400, body: { error: err.message } };
  }
  if (err instanceof GuestMdmRequiredError) {
    return { status: 400, body: { error: err.message } };
  }
  if (err instanceof GuestIdentityRequiredError) {
    return { status: 400, body: { error: err.message, code: 'GUEST_IDENTITY_REQUIRED', fields: err.fields } };
  }
  if (err instanceof StayCheckInBlockedError) {
    return { status: 400, body: { error: err.message, code: 'GUEST_CHECK_IN_INCOMPLETE', people: err.people } };
  }
  if (err instanceof LaundryOpenError) {
    return { status: 409, body: { error: err.message, code: err.code, tickets: err.tickets } };
  }
  if (err instanceof OccupiedHkLockedError) {
    return { status: err.status, body: { error: err.message, code: err.code } };
  }
  if (err instanceof RoomTypeSettlementRequiredError) {
    return { status: err.status, body: { error: err.message, code: err.code } };
  }
  if (err instanceof Error) {
    const known = [
      'COMMERCIAL_AMEND_REQUIRED',
      'AGENCY_FOLIO_HAS_LINES',
      'COMPANY_FOLIO_HAS_LINES',
      'CONTRACT_REQUIRED_FOR_PAYER',
      'AGENCY_REQUIRED_FOR_PAYER',
      'COMPANY_REQUIRED_FOR_PAYER',
      'COMMERCIAL_MOVE_REASON_REQUIRED',
      'PAYMENT_ARTICLE_NO_OPEN_DEBT',
    ];
    if (known.includes(err.message)) {
      return { status: 409, body: { error: err.message, code: err.message } };
    }
  }
  if (err instanceof BusinessDateLagError) {
    return {
      status: 409,
      body: {
        error: err.message,
        code: err.code,
        businessDate: err.businessDate,
        arrivalDate: err.arrivalDate,
      },
    };
  }
  if (err instanceof TourConflictError) {
    return { status: 409, body: { error: err.message } };
  }
  if (err instanceof Error) {
    const status = (err as Error & { status?: number }).status;
    const lower = err.message.toLowerCase();
    if (typeof status === 'number' && status >= 400 && status < 600) {
      const extra = err as { code?: unknown; from?: unknown; to?: unknown };
      if (typeof extra.code === 'string' && !extra.code.startsWith('P')) {
        return {
          status,
          body: {
            error: err.message,
            code: extra.code,
            ...(typeof extra.from === 'string' ? { from: extra.from } : {}),
            ...(typeof extra.to === 'string' ? { to: extra.to } : {}),
          },
        };
      }
      return { status, body: { error: err.message } };
    }
    if (lower.includes('unauthorized')) {
      return { status: 401, body: { error: err.message } };
    }
    if (lower.includes('forbidden') || lower.includes('insufficient permissions')) {
      return { status: 403, body: { error: err.message } };
    }
    if (
      lower.includes('idempotency conflict') ||
      lower.includes('duplicate') ||
      lower.includes('no contract allotment') ||
      lower.includes('contract allotment') ||
      lower.includes('no availability') ||
      lower.includes('room conflict') ||
      lower.includes('share pool') ||
      lower.includes('opposite gender') ||
      lower.includes('roommate remains') ||
      lower.includes('exclusive stay')
    ) {
      return { status: 409, body: { error: err.message } };
    }
    if (err.name === 'PrismaClientKnownRequestError') {
      const code = (err as { code?: string }).code;
      const target = (err as { meta?: { target?: string[] | string } }).meta?.target;
      const fields = Array.isArray(target) ? target : target ? [target] : [];
      console.error(err);
      if (code === 'P2002' && fields.includes('reservationId')) {
        return { status: 409, body: { error: 'This stay already has a check-in record', code: 'STAY_RECORD_EXISTS' } };
      }
      const targetText = fields.join(' ');
      const modelName = (err as { meta?: { modelName?: string } }).meta?.modelName;
      const groupCodeTaken =
        code === 'P2002' &&
        (modelName === 'ReservationGroup' ||
          targetText.includes('ReservationGroup_organizationId_code'));
      if (groupCodeTaken) {
        return { status: 409, body: { error: 'A group with this code already exists', code: 'GROUP_CODE_TAKEN' } };
      }
      if (
        code === 'P2002' &&
        (modelName === 'FolioPaymentAllocation' ||
          (fields.includes('paymentId') && fields.includes('chargeId')))
      ) {
        return { status: 409, body: { error: 'This payment is already applied to that charge', code: 'ALLOCATION_EXISTS' } };
      }
      // Surface the real Prisma code for desk ops (timeouts, unique) — do not
      // mask cash-shift / settle failures as a generic stay-save error.
      if (code === 'P2028' || lower.includes('transaction') || lower.includes('timeout')) {
        return { status: 400, body: { error: err.message || 'Database timed out', code: code ?? 'STAY_SAVE_FAILED' } };
      }
      return { status: 400, body: { error: err.message || 'Could not save this stay', code: code ?? 'STAY_SAVE_FAILED' } };
    }
    if (err.name === 'PrismaClientValidationError') {
      // Never echo the Prisma Request dump (headers/append) to the desk UI.
      console.error(err);
      return { status: 400, body: { error: 'Could not save this stay', code: 'STAY_SAVE_FAILED' } };
    }
    const known = ['not found', 'invalid', 'cannot', 'only', 'must'];
    if (known.some((k) => lower.includes(k))) {
      return { status: 400, body: { error: err.message } };
    }
    console.error(err);
    return { status: 500, body: { error: err.message } };
  }
  console.error(err);
  return { status: 500, body: { error: 'Internal server error' } };
}

export function handleRouteError(err: unknown) {
  const described = describeRouteError(err);
  return NextResponse.json(described.body, { status: described.status });
}
