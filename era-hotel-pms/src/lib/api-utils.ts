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
import { scheduleHotelHttpMutationAudit } from '@/lib/mutation-audit-belt';

export function jsonOk<T>(data: T, status = 200) {
  // Layer A HTTP belt — ADR era-mutation-audit-standard / HOT-AUD-01
  scheduleHotelHttpMutationAudit(status);
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleRouteError(err: unknown) {
  if (isSatelliteBillingBlockedError(err)) {
    return NextResponse.json(
      { error: err.message, code: err.code, billingStatus: err.billingStatus },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    return jsonError(err.errors.map((e) => e.message).join('; '), 400);
  }
  if (err instanceof IndustryModuleInactiveError) {
    return jsonError(err.message, 403);
  }
  if (err instanceof Error && err.name === 'FiscalError') {
    return jsonError(err.message, 400);
  }
  if (err instanceof GuestMdmRequiredError) {
    return jsonError(err.message, 400);
  }
  if (err instanceof GuestIdentityRequiredError) {
    return NextResponse.json(
      { error: err.message, code: 'GUEST_IDENTITY_REQUIRED', fields: err.fields },
      { status: 400 },
    );
  }
  if (err instanceof StayCheckInBlockedError) {
    return NextResponse.json(
      { error: err.message, code: 'GUEST_CHECK_IN_INCOMPLETE', people: err.people },
      { status: 400 },
    );
  }
  if (err instanceof LaundryOpenError) {
    return NextResponse.json(
      { error: err.message, code: err.code, tickets: err.tickets },
      { status: 409 },
    );
  }
  if (err instanceof OccupiedHkLockedError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  if (err instanceof RoomTypeSettlementRequiredError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
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
      return NextResponse.json({ error: err.message, code: err.message }, { status: 409 });
    }
  }
  if (err instanceof BusinessDateLagError) {
    return NextResponse.json(
      {
        error: err.message,
        code: err.code,
        businessDate: err.businessDate,
        arrivalDate: err.arrivalDate,
      },
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
      const extra = err as { code?: unknown; from?: unknown; to?: unknown };
      if (typeof extra.code === 'string' && !extra.code.startsWith('P')) {
        return NextResponse.json(
          {
            error: err.message,
            code: extra.code,
            ...(typeof extra.from === 'string' ? { from: extra.from } : {}),
            ...(typeof extra.to === 'string' ? { to: extra.to } : {}),
          },
          { status },
        );
      }
      return jsonError(err.message, status);
    }
    if (lower.includes('unauthorized')) {
      return jsonError(err.message, 401);
    }
    if (lower.includes('forbidden') || lower.includes('insufficient permissions')) {
      return jsonError(err.message, 403);
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
      return jsonError(err.message, 409);
    }
    if (err.name === 'PrismaClientKnownRequestError') {
      const code = (err as { code?: string }).code;
      const target = (err as { meta?: { target?: string[] | string } }).meta?.target;
      const fields = Array.isArray(target) ? target : target ? [target] : [];
      console.error(err);
      if (code === 'P2002' && fields.includes('reservationId')) {
        return NextResponse.json(
          { error: 'This stay already has a check-in record', code: 'STAY_RECORD_EXISTS' },
          { status: 409 },
        );
      }
      const targetText = fields.join(' ');
      const modelName = (err as { meta?: { modelName?: string } }).meta?.modelName;
      const groupCodeTaken =
        code === 'P2002' &&
        (modelName === 'ReservationGroup' ||
          targetText.includes('ReservationGroup_organizationId_code'));
      if (groupCodeTaken) {
        return NextResponse.json(
          { error: 'A group with this code already exists', code: 'GROUP_CODE_TAKEN' },
          { status: 409 },
        );
      }
      // Surface the real Prisma code for desk ops (timeouts, unique) — do not
      // mask cash-shift / settle failures as a generic stay-save error.
      if (code === 'P2028' || lower.includes('transaction') || lower.includes('timeout')) {
        return NextResponse.json(
          { error: err.message || 'Database timed out', code: code ?? 'STAY_SAVE_FAILED' },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: err.message || 'Could not save this stay', code: code ?? 'STAY_SAVE_FAILED' },
        { status: 400 },
      );
    }
    if (err.name === 'PrismaClientValidationError') {
      console.error(err);
      return NextResponse.json(
        { error: err.message || 'Could not save this stay', code: 'STAY_SAVE_FAILED' },
        { status: 400 },
      );
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
