import { z } from 'zod';
import { NextResponse } from 'next/server';
import { validateProcedureCompatibility } from '@/lib/procedure-compatibility.service';

const schema = z.object({
  procedureCode: z.string().min(1),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  existing: z.array(
    z.object({
      procedureCode: z.string(),
      startAt: z.coerce.date(),
      endAt: z.coerce.date(),
    }),
  ),
});

function verifyInternalToken(request: Request): boolean {
  const token =
    process.env.CLINIC_INTERNAL_SERVICE_TOKEN?.trim() ||
    process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
  if (!token) return process.env.NODE_ENV !== 'production';
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${token}`;
}

export async function POST(request: Request) {
  if (!verifyInternalToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = schema.parse(await request.json());
    const violations = await validateProcedureCompatibility({
      candidateCode: body.procedureCode,
      startAt: body.startAt,
      endAt: body.endAt,
      existing: body.existing,
    });
    return NextResponse.json({ ok: violations.length === 0, violations });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Validation failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
