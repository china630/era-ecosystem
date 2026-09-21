import type { FiscalDeviceKind, FiscalDeviceRef } from "./types";

/** In-memory / injectable device catalog (F0). F2 hydrates from orchestrator Sync. */
export type DeviceDirectory = {
  list(organizationId: string): FiscalDeviceRef[];
  get(organizationId: string, deviceId: string): FiscalDeviceRef | undefined;
  upsert(device: FiscalDeviceRef): void;
  remove(organizationId: string, deviceId: string): void;
  clear(organizationId?: string): void;
};

export function createMemoryDeviceDirectory(
  seed: FiscalDeviceRef[] = [],
): DeviceDirectory {
  const byOrg = new Map<string, Map<string, FiscalDeviceRef>>();

  function orgMap(organizationId: string): Map<string, FiscalDeviceRef> {
    let m = byOrg.get(organizationId);
    if (!m) {
      m = new Map();
      byOrg.set(organizationId, m);
    }
    return m;
  }

  for (const d of seed) {
    orgMap(d.organizationId).set(d.id, d);
  }

  return {
    list(organizationId: string) {
      return [...(byOrg.get(organizationId)?.values() ?? [])];
    },
    get(organizationId: string, deviceId: string) {
      return byOrg.get(organizationId)?.get(deviceId);
    },
    upsert(device: FiscalDeviceRef) {
      orgMap(device.organizationId).set(device.id, device);
    },
    remove(organizationId: string, deviceId: string) {
      byOrg.get(organizationId)?.delete(deviceId);
    },
    clear(organizationId?: string) {
      if (organizationId) byOrg.delete(organizationId);
      else byOrg.clear();
    },
  };
}

let globalDirectory: DeviceDirectory = createMemoryDeviceDirectory();

export function getDeviceDirectory(): DeviceDirectory {
  return globalDirectory;
}

export function setDeviceDirectory(dir: DeviceDirectory): void {
  globalDirectory = dir;
}

export function resetDeviceDirectoryForTests(): void {
  globalDirectory = createMemoryDeviceDirectory();
}

export function filterDevices(
  devices: FiscalDeviceRef[],
  opts: {
    kind?: FiscalDeviceKind;
    outletCode?: string;
    registerRef?: string;
    activeOnly?: boolean;
  },
): FiscalDeviceRef[] {
  const activeOnly = opts.activeOnly !== false;
  return devices.filter((d) => {
    if (activeOnly && d.status !== "active") return false;
    if (opts.kind && d.kind !== opts.kind) return false;
    if (opts.outletCode) {
      // Org-wide devices (no outlet) are visible everywhere.
      if (d.outletCode && d.outletCode !== opts.outletCode) return false;
    }
    if (opts.registerRef) {
      if (d.registerCode && d.registerCode !== opts.registerRef) return false;
    }
    return true;
  });
}
