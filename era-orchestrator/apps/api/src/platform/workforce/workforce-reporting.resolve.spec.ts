import {
  resolveLineManager,
  resolveManagerChain,
  resolveMatrixManager,
  resolveUnitManagerWalk,
} from "./workforce-reporting.resolve";

const units = [
  {
    id: "root",
    parentId: null as string | null,
    name: "HQ",
    managerEmploymentId: "dir",
    managerUserId: null as string | null,
  },
  {
    id: "med",
    parentId: "root",
    name: "Med",
    managerEmploymentId: "chief",
    managerUserId: null,
  },
  {
    id: "ward",
    parentId: "med",
    name: "Ward",
    managerEmploymentId: null,
    managerUserId: null,
  },
];

function emp(
  id: string,
  orgUnitId: string,
  extra: Partial<{
    status: string;
    managerEmploymentId: string | null;
    matrixManagerEmploymentId: string | null;
    platformUserId: string | null;
  }> = {},
) {
  return {
    id,
    orgUnitId,
    status: extra.status ?? "ACTIVE",
    managerEmploymentId: extra.managerEmploymentId ?? null,
    matrixManagerEmploymentId: extra.matrixManagerEmploymentId ?? null,
    platformUserId: extra.platformUserId ?? null,
  };
}

describe("workforce-reporting.resolve", () => {
  it("lineManager uses employment override when ACTIVE", () => {
    const nurse = emp("nurse", "ward", { managerEmploymentId: "boss" });
    const boss = emp("boss", "med", { platformUserId: "u-boss" });
    const byId = new Map([
      [nurse.id, nurse],
      [boss.id, boss],
      ["chief", emp("chief", "med")],
      ["dir", emp("dir", "root")],
    ]);
    const hit = resolveLineManager({
      employment: nurse,
      units,
      employmentsById: byId,
    });
    expect(hit?.employmentId).toBe("boss");
    expect(hit?.userId).toBe("u-boss");
  });

  it("lineManager ignores terminated override and walks unit", () => {
    const nurse = emp("nurse", "ward", { managerEmploymentId: "gone" });
    const byId = new Map([
      [nurse.id, nurse],
      ["gone", emp("gone", "med", { status: "TERMINATED" })],
      ["chief", emp("chief", "med")],
      ["dir", emp("dir", "root")],
    ]);
    const hit = resolveLineManager({
      employment: nurse,
      units,
      employmentsById: byId,
    });
    expect(hit?.employmentId).toBe("chief");
  });

  it("unit walk skips self when requester is unit manager", () => {
    const chief = emp("chief", "med");
    const hit = resolveUnitManagerWalk({
      startOrgUnitId: "med",
      requesterEmploymentId: "chief",
      units,
    });
    expect(hit?.employmentId).toBe("dir");
  });

  it("managerChain walks n hops", () => {
    const nurse = emp("nurse", "ward", { managerEmploymentId: "chief" });
    const chief = emp("chief", "med", { managerEmploymentId: "dir" });
    const dir = emp("dir", "root");
    const byId = new Map([
      [nurse.id, nurse],
      [chief.id, chief],
      [dir.id, dir],
    ]);
    const hit = resolveManagerChain({
      employment: nurse,
      units,
      employmentsById: byId,
      chainOffset: 2,
    });
    expect(hit?.employmentId).toBe("dir");
  });

  it("matrixManager returns dotted line", () => {
    const nurse = emp("nurse", "ward", {
      matrixManagerEmploymentId: "matrix",
    });
    const matrix = emp("matrix", "root", { platformUserId: "u-m" });
    const hit = resolveMatrixManager({
      employment: nurse,
      units,
      employmentsById: new Map([
        [nurse.id, nurse],
        [matrix.id, matrix],
      ]),
    });
    expect(hit?.employmentId).toBe("matrix");
    expect(hit?.userId).toBe("u-m");
  });
});
