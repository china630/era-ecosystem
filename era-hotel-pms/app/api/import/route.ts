import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { listImportEntities } from '@/lib/import/adapters';
import { assertPlatformSuperAdminImport } from '@/lib/import/auth';

export async function GET() {
  try {
    await assertPlatformSuperAdminImport();
    return jsonOk(listImportEntities());
  } catch (err) {
    return handleRouteError(err);
  }
}
