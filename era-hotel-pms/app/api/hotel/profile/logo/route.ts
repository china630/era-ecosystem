import { NextResponse } from 'next/server';
import { jsonOk, jsonError, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertAnyPermission, assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { deleteHotelLogo, readHotelLogo, saveHotelLogo } from '@/lib/services/hotel-letterhead.service';

export async function GET() {
  try {
    const session = await getSatelliteSession();
    assertAnyPermission(session, [PERMISSIONS.MASTER_DATA_MANAGE, PERMISSIONS.REPORTS_READ]);
    const logo = await readHotelLogo();
    if (!logo) return jsonError('Logo not set', 404);
    return new NextResponse(new Uint8Array(logo.buffer), {
      headers: { 'Content-Type': logo.mimeType, 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return jsonError('file required', 400);
    const profile = await saveHotelLogo({
      buffer: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
    });
    return jsonOk(serialize(profile), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE() {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.MASTER_DATA_MANAGE);
    return jsonOk(serialize(await deleteHotelLogo()));
  } catch (err) {
    return handleRouteError(err);
  }
}
