export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { prisma } = await import("@/lib/prisma");
  const { upsertFnbOrgSnapshot } = await import("@/lib/fnb-org-snapshot");
  const { onSatelliteBoot } = await import(
    /* webpackIgnore: true */ "@era/satellite-kit/tenancy/boot"
  );
  try {
    const result = await onSatelliteBoot({
      prisma,
      onSharedOrgSnapshot: async (organizationId, snap) => {
        await upsertFnbOrgSnapshot(organizationId, {
          edition: snap.edition,
          activeModules: snap.activeModules,
        });
      },
    });
    if (result.organizationId) {
      console.info(
        `[fnb-pos] organization bind hydrated source=${result.source} org=${result.organizationId}`,
      );
    } else {
      console.warn("[fnb-pos] organization bind not set at boot (Sync or env required in production)");
    }
  } catch (err) {
    console.error("[fnb-pos] onSatelliteBoot failed", err);
  }
}
