export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { prisma } = await import("@/lib/prisma");
  const { onSatelliteBoot, setRuntimeOrganizationId } = await import(
    /* webpackIgnore: true */ "@era/satellite-kit/tenancy/boot"
  );
  const bankOrg =
    process.env.ERA_BANK_ORGANIZATION_ID?.trim() ||
    process.env.ERA_SATELLITE_ORGANIZATION_ID?.trim();
  if (bankOrg) setRuntimeOrganizationId(bankOrg);
  try {
    const result = await onSatelliteBoot({ prisma });
    if (result.organizationId) {
      console.info(
        `[bank-dbo] organization bind hydrated source=${result.source} org=${result.organizationId}`,
      );
    } else {
      console.warn(
        "[bank-dbo] organization bind not set at boot (Sync or env required in production)",
      );
    }
  } catch (err) {
    console.error("[bank-dbo] onSatelliteBoot failed", err);
  }
}
