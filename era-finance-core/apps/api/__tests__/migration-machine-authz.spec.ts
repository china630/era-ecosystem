import { PERMISSIONS_KEY } from "../src/common/decorators/permissions.decorator";
import { MigrationController } from "../src/migration/migration.controller";
import { CP_PERMISSION } from "@era/contracts";

function permissionsOn(methodName: keyof MigrationController): string[] {
  const proto = MigrationController.prototype;
  const meta = Reflect.getMetadata(PERMISSIONS_KEY, proto[methodName]) as
    | string[]
    | undefined;
  return meta ?? [];
}

describe("Migration machine AuthZ metadata (AC-FIN-MIG)", () => {
  it("upload requires api:migration.upload", () => {
    expect(permissionsOn("upload")).toContain(CP_PERMISSION.API_MIGRATION_UPLOAD);
  });

  it("assemble requires api:migration.assemble", () => {
    expect(permissionsOn("assembleAll")).toContain(CP_PERMISSION.API_MIGRATION_ASSEMBLE);
  });

  it("validate requires api:migration.assemble", () => {
    expect(permissionsOn("validate")).toContain(CP_PERMISSION.API_MIGRATION_ASSEMBLE);
  });

  it("cutover requires api:migration.assemble", () => {
    expect(permissionsOn("setCutover")).toContain(CP_PERMISSION.API_MIGRATION_ASSEMBLE);
  });
});
