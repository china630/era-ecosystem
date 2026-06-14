import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import {
  submitMigrationToRegistry,
  exportMigrationPayload,
} from '@/lib/services/tourism-registry.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = await params;
    return jsonOk(serialize(await submitMigrationToRegistry(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const { id } = await params;
    return jsonOk(serialize(await exportMigrationPayload(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}
