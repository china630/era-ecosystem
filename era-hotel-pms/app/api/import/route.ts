import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { listImportEntities } from '@/lib/import/adapters';
import { assertHotelImportAccess } from '@/lib/import/auth';

export async function GET() {
  try {
    await assertHotelImportAccess();
    return jsonOk(listImportEntities());
  } catch (err) {
    return handleRouteError(err);
  }
}
