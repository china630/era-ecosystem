import { qualifiesForNurseBonus } from "@/domain/procedure/nurse-bonus";
import { getImportAdapter } from "@/lib/import/adapters";

jest.mock("@era/satellite-kit", () => ({
  satelliteOrganizationId: () => "org-test",
  resolveSatelliteTenantOrgId: () => "org-test",
  enterSatelliteTenant: () => undefined,
  linkPersonIdentity: jest.fn().mockResolvedValue({ globalPersonId: null }),
}));

jest.mock("@/lib/import/cutover-patient-mdm", () => ({
  resolveCutoverPatientMdm: jest.fn().mockResolvedValue("gp-cutover"),
}));

jest.mock("@/domain/physio/nahiye-cutover.service", () => ({
  applyNahiyeToProcedureOrder: jest.fn().mockResolvedValue(undefined),
}));

describe("nafta cutover import rules", () => {
  it("maps patient card fields including sex nationality phone", () => {
    const adapter = getImportAdapter("patients")!;
    const mapped = adapter.mapRow({
      externalRef: "wo:patient:2148",
      woId: "2148",
      fullName: "RAFIL KURBANOV",
      givenName: "RAFIL",
      surname: "KURBANOV",
      sex: "MALE",
      birthDate: "1970-04-13",
      nationality: "Russian",
      phone: "+994501112233",
      hotelResNo: "11112877",
      roomNumber: "711",
      folioPerson: "1",
      uniqueId: "",
      checkIn: "2026-08-27",
      checkOut: "2026-09-04",
      treatmentDaysCount: "",
      nightCount: "8",
      isReservationPatient: "true",
      doctorId: "3",
      doctorName: "Yoxdur",
      doctorFormCreatedAt: "",
      checkUpId: "0",
      checkUpName: "",
      programCode: "",
      latestPainDegree: "",
      latestPainDegreeCreatedAt: "",
    });
    expect(adapter.rowSchema.parse(mapped)).toMatchObject({
      sex: "MALE",
      nationality: "Russian",
      phone: "+994501112233",
      hotelResNo: "11112877",
      givenName: "RAFIL",
    });
  });

  it("patient upsert writes globalPersonId from MDM resolve", async () => {
    const { resolveCutoverPatientMdm } = jest.requireMock("@/lib/import/cutover-patient-mdm") as {
      resolveCutoverPatientMdm: jest.Mock;
    };
    const adapter = getImportAdapter("patients")!;
    const mapped = adapter.mapRow({
      externalRef: "wo:patient:2148",
      fullName: "RAFIL KURBANOV",
      sex: "MALE",
      birthDate: "1970-04-13",
      nationality: "Russian",
      phone: "",
      hotelResNo: "11112877",
      roomNumber: "711",
      folioPerson: "1",
      checkIn: "2026-08-27",
      checkOut: "2026-09-04",
      isReservationPatient: "true",
      programCode: "",
    });
    const row = adapter.rowSchema.parse(mapped);
    const createPatient = jest.fn().mockResolvedValue({ id: "pat1" });
    const createEpisode = jest.fn().mockResolvedValue({ id: "ep1" });
    const tx = {
      cutoverImportKey: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      patientRef: { create: createPatient },
      clinicalEpisode: { create: createEpisode },
    };
    await adapter.upsert(tx as never, row, false);
    expect(resolveCutoverPatientMdm).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: "RAFIL KURBANOV", hotelResNo: "11112877" }),
    );
    expect(createPatient).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          globalPersonId: "gp-cutover",
          anamnesisText: "Nafta cutover import",
        }),
      }),
    );
    expect(createEpisode).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ globalPersonId: "gp-cutover" }),
      }),
    );
  });

  it("creates OPEN episode when checkOut is today or later", async () => {
    const adapter = getImportAdapter("patients")!;
    const mapped = adapter.mapRow({
      externalRef: "wo:patient:inhouse",
      fullName: "Stay Guest",
      sex: "FEMALE",
      birthDate: "1980-01-01",
      nationality: "AZ",
      phone: "",
      hotelResNo: "11110001",
      roomNumber: "101",
      folioPerson: "1",
      checkIn: "2099-01-01",
      checkOut: "2099-12-31",
      isReservationPatient: "true",
      programCode: "",
    });
    const createEpisode = jest.fn().mockResolvedValue({ id: "ep1" });
    const tx = {
      cutoverImportKey: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      patientRef: { create: jest.fn().mockResolvedValue({ id: "pat1" }) },
      clinicalEpisode: { create: createEpisode },
    };
    await adapter.upsert(tx as never, adapter.rowSchema.parse(mapped), false);
    const payload = createEpisode.mock.calls[0][0].data as { status: string; closedAt?: Date };
    expect(payload.status).toBe("OPEN");
    expect(payload.closedAt).toBeUndefined();
  });

  it("creates IMPORTED_CLOSED episode when checkOut is in the past", async () => {
    const adapter = getImportAdapter("patients")!;
    const mapped = adapter.mapRow({
      externalRef: "wo:patient:left",
      fullName: "Left Guest",
      sex: "MALE",
      birthDate: "1980-01-01",
      nationality: "AZ",
      phone: "",
      hotelResNo: "11110002",
      roomNumber: "102",
      folioPerson: "1",
      checkIn: "2020-01-01",
      checkOut: "2020-01-15",
      isReservationPatient: "true",
      programCode: "",
    });
    const createEpisode = jest.fn().mockResolvedValue({ id: "ep1" });
    const tx = {
      cutoverImportKey: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      patientRef: { create: jest.fn().mockResolvedValue({ id: "pat1" }) },
      clinicalEpisode: { create: createEpisode },
    };
    await adapter.upsert(tx as never, adapter.rowSchema.parse(mapped), false);
    expect(createEpisode).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "IMPORTED_CLOSED",
          closedAt: new Date("2020-01-15"),
        }),
      }),
    );
  });

  it("re-import of OPEN episode with past checkOut sets IMPORTED_CLOSED", async () => {
    const adapter = getImportAdapter("patients")!;
    const mapped = adapter.mapRow({
      externalRef: "wo:patient:left",
      fullName: "Left Guest",
      sex: "MALE",
      birthDate: "1980-01-01",
      nationality: "AZ",
      phone: "",
      hotelResNo: "11110002",
      roomNumber: "102",
      folioPerson: "1",
      checkIn: "2020-01-01",
      checkOut: "2020-01-15",
      isReservationPatient: "true",
      programCode: "",
    });
    const updateEpisode = jest.fn();
    const tx = {
      cutoverImportKey: {
        findFirst: jest.fn().mockResolvedValue({ recordId: "pat1" }),
      },
      patientRef: {
        findUnique: jest.fn().mockResolvedValue({ globalPersonId: "gp-cutover" }),
        update: jest.fn(),
      },
      clinicalEpisode: {
        findFirst: jest.fn().mockResolvedValue({
          id: "ep-open",
          roomNumber: "102",
          reservationId: "11110002",
          programCode: null,
        }),
        update: updateEpisode,
      },
    };
    await adapter.upsert(tx as never, adapter.rowSchema.parse(mapped), false);
    expect(tx.clinicalEpisode.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { patientRefId: "pat1" },
        orderBy: { openedAt: "desc" },
      }),
    );
    expect(updateEpisode).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ep-open" },
        data: expect.objectContaining({
          status: "IMPORTED_CLOSED",
          closedAt: new Date("2020-01-15"),
          openedAt: new Date("2020-01-01"),
        }),
      }),
    );
  });

  it("re-import updates latest episode of any status (no DB wipe)", async () => {
    const adapter = getImportAdapter("patients")!;
    const mapped = adapter.mapRow({
      externalRef: "wo:patient:left",
      fullName: "Left Guest",
      sex: "MALE",
      birthDate: "1980-01-01",
      nationality: "AZ",
      phone: "",
      hotelResNo: "11110002",
      roomNumber: "205",
      folioPerson: "1",
      checkIn: "2020-01-01",
      checkOut: "2020-01-15",
      isReservationPatient: "true",
      programCode: "PKG-A",
    });
    const updateEpisode = jest.fn();
    const createEpisode = jest.fn();
    const tx = {
      cutoverImportKey: {
        findFirst: jest.fn().mockResolvedValue({ recordId: "pat1" }),
      },
      patientRef: {
        findUnique: jest.fn().mockResolvedValue({ globalPersonId: "gp-cutover" }),
        update: jest.fn(),
      },
      clinicalEpisode: {
        findFirst: jest.fn().mockResolvedValue({
          id: "ep-closed",
          roomNumber: "102",
          reservationId: "old",
          programCode: null,
        }),
        update: updateEpisode,
        create: createEpisode,
      },
    };
    await adapter.upsert(tx as never, adapter.rowSchema.parse(mapped), false);
    expect(tx.clinicalEpisode.findFirst.mock.calls[0][0].where).toEqual({ patientRefId: "pat1" });
    expect(updateEpisode).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ep-closed" },
        data: expect.objectContaining({
          status: "IMPORTED_CLOSED",
          roomNumber: "205",
          reservationId: "11110002",
          programCode: "PKG-A",
          openedAt: new Date("2020-01-01"),
          closedAt: new Date("2020-01-15"),
        }),
      }),
    );
    expect(createEpisode).not.toHaveBeenCalled();
  });

  it("creates attending Visit from WO doctorId via #27 wo:doctor:{id}", async () => {
    const adapter = getImportAdapter("patients")!;
    const mapped = adapter.mapRow({
      externalRef: "wo:patient:2148",
      fullName: "RAFIL KURBANOV",
      sex: "MALE",
      birthDate: "1970-04-13",
      nationality: "AZ",
      phone: "",
      hotelResNo: "11112877",
      roomNumber: "711",
      folioPerson: "1",
      checkIn: "2099-01-01",
      checkOut: "2099-12-31",
      isReservationPatient: "true",
      programCode: "",
      doctorId: "3",
    });
    const createVisit = jest.fn().mockResolvedValue({ id: "vis1" });
    const tx = {
      cutoverImportKey: {
        findFirst: jest.fn(async ({ where }: { where: { entity: string; externalRef?: string } }) => {
          if (where.entity === "practitioners" && where.externalRef === "wo:doctor:3") {
            return { recordId: "prac-3" };
          }
          return null;
        }),
        create: jest.fn(),
      },
      patientRef: { create: jest.fn().mockResolvedValue({ id: "pat1" }) },
      clinicalEpisode: { create: jest.fn().mockResolvedValue({ id: "ep1" }) },
      visit: { create: createVisit, update: jest.fn() },
    };
    await adapter.upsert(tx as never, adapter.rowSchema.parse(mapped), false);
    expect(createVisit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          patientRefId: "pat1",
          practitionerId: "prac-3",
          status: "IN_PROGRESS",
        }),
      }),
    );
  });
  it("maps procedure rows from English headers", () => {
    const adapter = getImportAdapter("procedures")!;
    const mapped = adapter.mapRow({
      externalRef: "wo:treatment:10",
      code: "WO-TR-10",
      nameAz: "Vanna",
      durationMin: "15",
      resourceGapMinutes: "5",
      patientRestMinutes: "10",
      price: "12.5",
    });
    expect(adapter.rowSchema.parse(mapped)).toMatchObject({
      externalRef: "wo:treatment:10",
      code: "WO-TR-10",
      durationMin: 15,
    });
  });

  it("procedure Apply attaches WO-TR to existing SVC seed row", async () => {
    const adapter = getImportAdapter("procedures")!;
    const mapped = adapter.mapRow({
      externalRef: "wo:treatment:10",
      code: "WO-TR-10",
      nameAz: "Amplipuls",
      durationMin: "15",
      resourceGapMinutes: "5",
      patientRestMinutes: "10",
      price: "12.5",
    });
    const row = adapter.rowSchema.parse(mapped);
    const create = jest.fn();
    const tx = {
      cutoverImportKey: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      procedureType: {
        findMany: jest.fn().mockResolvedValue([
          { id: "svc-amp", code: "SVC-AMPLIPULS", name: "Amplipuls" },
        ]),
        create,
      },
    };
    await adapter.upsert(tx as never, row, false);
    expect(create).not.toHaveBeenCalled();
    expect(tx.cutoverImportKey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ recordId: "svc-amp" }),
      }),
    );
  });

  it("maps lab order panel and COMPLETED status", () => {
    const adapter = getImportAdapter("lab-orders")!;
    const mapped = adapter.mapRow({
      externalRef: "wo:lab:57",
      patientRef: "wo:patient:451",
      testCode: "LAB-CBC",
      status: "COMPLETED",
      panel: "QAN",
      takenAt: "2026-02-18",
    });
    expect(adapter.rowSchema.parse(mapped)).toMatchObject({
      panel: "QAN",
      testCode: "LAB-CBC",
      status: "COMPLETED",
    });
  });

  it("does not award nurse bonus on imported historical orders", () => {
    expect(
      qualifiesForNurseBonus({
        checkedInAt: new Date(),
        status: "COMPLETED",
        importedHistorical: true,
      }),
    ).toBe(false);
  });

  it("diagnoses upsert uses CLOSED episode when no OPEN", async () => {
    const adapter = getImportAdapter("diagnoses")!;
    const mapped = adapter.mapRow({
      patientRef: "wo:patient:99",
      rawText: "Arxiv qeydi",
      icd10: "",
      recordedAt: "2024-01-15",
    });
    const row = adapter.rowSchema.parse(mapped);
    const createComplaint = jest.fn().mockResolvedValue({ id: "cmp1" });
    const tx = {
      cutoverImportKey: {
        findFirst: jest.fn(async ({ where }: { where: { entity: string } }) =>
          where.entity === "patients" ? { recordId: "pat1" } : null,
        ),
        create: jest.fn(),
      },
      clinicalEpisode: {
        findFirst: jest.fn().mockResolvedValue({ id: "ep-closed", programCode: "CUTOVER-ARCHIVE" }),
        create: jest.fn(),
      },
      clinicalComplaint: { create: createComplaint },
      icdCode: { findFirst: jest.fn() },
      clinicalDiagnosis: { create: jest.fn() },
    };
    await adapter.upsert(tx as never, row, false);
    expect(createComplaint).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ episodeId: "ep-closed" }) }),
    );
  });

  it("procedure requirement upsert links procedure code to resource", async () => {
    const adapter = getImportAdapter("procedure-requirements")!;
    const mapped = adapter.mapRow({
      procedureCode: "WO-TR-47",
      resourceCode: "WO-ROOM-44",
      role: "LOCATION",
      quantity: "1",
    });
    const row = adapter.rowSchema.parse(mapped);
    const create = jest.fn().mockResolvedValue({ id: "req1" });
    const tx = {
      cutoverImportKey: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      procedureType: {
        findFirst: jest.fn().mockResolvedValue({ id: "proc1" }),
      },
      resource: {
        findFirst: jest.fn().mockResolvedValue({ id: "res1" }),
      },
      procedureTypeRequirement: { create },
    };
    await adapter.upsert(tx as never, row, false);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          procedureTypeId: "proc1",
          role: "LOCATION",
          resourceCode: "WO-ROOM-44",
          quantity: 1,
        }),
      }),
    );
  });

  it("quota upsert writes quotaTotal / quotaUsed", async () => {
    const adapter = getImportAdapter("quotas")!;
    const mapped = adapter.mapRow({
      patientRef: "wo:patient:1",
      procedureCode: "WO-TR-10",
      quotaTotal: 10,
      quotaUsed: 3,
      quotaLeft: 7,
    });
    const row = adapter.rowSchema.parse(mapped);
    const create = jest.fn().mockResolvedValue({ id: "bal1" });
    const tx = {
      cutoverImportKey: {
        findFirst: jest.fn().mockResolvedValue({ recordId: "pat1" }),
      },
      procedureType: { findFirst: jest.fn().mockResolvedValue(null) },
      clinicalEpisode: {
        findFirst: jest.fn().mockResolvedValue({
          id: "ep1",
          programCode: "STD",
        }),
      },
      programInstance: { findUnique: jest.fn().mockResolvedValue({ id: "inst1" }) },
      programProcedureBalance: {
        findUnique: jest.fn().mockResolvedValue(null),
        create,
      },
    };
    await adapter.upsert(tx as never, row, false);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quotaTotal: 10, quotaUsed: 3 }),
      }),
    );
  });

  it("lab upsert writes testCode and empty resultJson array", async () => {
    const adapter = getImportAdapter("lab-orders")!;
    const mapped = adapter.mapRow({
      externalRef: "wo:lab:1",
      patientRef: "wo:patient:1",
      testCode: "LAB-CBC",
      status: "COMPLETED",
      panel: "QAN",
      takenAt: "2026-02-18",
    });
    const row = adapter.rowSchema.parse(mapped);
    const createOrder = jest.fn().mockResolvedValue({ id: "lab1" });
    const createItem = jest.fn().mockResolvedValue({ id: "item1" });
    const tx = {
      cutoverImportKey: {
        findFirst: jest.fn(async ({ where }: { where: { entity: string } }) =>
          where.entity === "patients" ? { recordId: "pat1" } : null,
        ),
        create: jest.fn(),
      },
      diagnosticService: { findFirst: jest.fn().mockResolvedValue({ id: "svc1" }) },
      clinicalEpisode: {
        findFirst: jest.fn().mockResolvedValue({ id: "ep1", openedAt: new Date("2026-02-18") }),
      },
      labOrder: { create: createOrder, update: jest.fn() },
      labOrderItem: { create: createItem },
    };
    await adapter.upsert(tx as never, row, false);
    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          testCode: "LAB-CBC",
          resultJson: "[]",
          clinicalEpisodeId: "ep1",
          collectedAt: expect.any(Date),
          createdAt: expect.any(Date),
        }),
      }),
    );
    expect(createOrder.mock.calls[0][0].data.createdAt.getTime()).toBe(
      createOrder.mock.calls[0][0].data.collectedAt.getTime(),
    );
    expect(createOrder.mock.calls[0][0].data.items).toBeUndefined();
    expect(createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          labOrderId: "lab1",
          serviceCode: "LAB-CBC",
          diagnosticServiceId: "svc1",
        }),
      }),
    );
  });

  it("lab upsert uses episode check-in when takenAt is empty", async () => {
    const adapter = getImportAdapter("lab-orders")!;
    const mapped = adapter.mapRow({
      externalRef: "wo:lab:2",
      patientRef: "wo:patient:1",
      testCode: "LAB-CBC",
      status: "COMPLETED",
      panel: "QAN",
      takenAt: "",
    });
    const row = adapter.rowSchema.parse(mapped);
    const checkIn = new Date("2024-08-12T00:00:00.000Z");
    const createOrder = jest.fn().mockResolvedValue({ id: "lab2" });
    const tx = {
      cutoverImportKey: {
        findFirst: jest.fn(async ({ where }: { where: { entity: string } }) =>
          where.entity === "patients" ? { recordId: "pat1" } : null,
        ),
        create: jest.fn(),
      },
      diagnosticService: { findFirst: jest.fn().mockResolvedValue({ id: "svc1" }) },
      clinicalEpisode: {
        findFirst: jest.fn().mockResolvedValue({ id: "ep1", openedAt: checkIn }),
      },
      labOrder: { create: createOrder, update: jest.fn() },
      labOrderItem: { create: jest.fn().mockResolvedValue({ id: "item1" }) },
    };
    await adapter.upsert(tx as never, row, false);
    expect(createOrder.mock.calls[0][0].data.collectedAt).toEqual(checkIn);
    expect(createOrder.mock.calls[0][0].data.createdAt).toEqual(checkIn);
  });

  it("lab result line upsert writes LabResult fields", async () => {
    const adapter = getImportAdapter("lab-results")!;
    const mapped = adapter.mapRow({
      orderRef: "wo:lab:1",
      code: "WBC",
      label: "WBC (Leykositlər)",
      value: "6.7",
      unit: "",
      refMin: "4.0",
      refMax: "10.0",
    });
    const row = adapter.rowSchema.parse(mapped);
    const create = jest.fn().mockResolvedValue({ id: "r1" });
    const tx = {
      cutoverImportKey: {
        findFirst: jest.fn().mockResolvedValue({ recordId: "lab1" }),
      },
      labOrderItem: { findFirst: jest.fn().mockResolvedValue({ id: "item1" }) },
      labResult: {
        findUnique: jest.fn().mockResolvedValue(null),
        create,
      },
      labOrder: {
        findUnique: jest.fn().mockResolvedValue({ resultJson: "[]" }),
        update: jest.fn(),
      },
    };
    await adapter.upsert(tx as never, row, false);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ code: "WBC", value: "6.7" }),
      }),
    );
  });

  it("re-Apply slots stamps clinicalEpisodeId on existing ProcedureOrder", async () => {
    const adapter = getImportAdapter("slots")!;
    const mapped = adapter.mapRow({
      externalRef: "wo:slot:1",
      date: "2026-08-20",
      startTime: "10:00:00",
      patientRef: "wo:patient:1",
      procedureCode: "WO-TR-10",
      roomCode: "WO-ROOM-1",
      status: "COMPLETED",
      nahiye: "",
    });
    const row = adapter.rowSchema.parse(mapped);
    const update = jest.fn();
    const tx = {
      cutoverImportKey: {
        findFirst: jest.fn(async ({ where }: { where: { entity: string } }) => {
          if (where.entity === "patients") return { recordId: "pat1" };
          if (where.entity === "slots") return { recordId: "ord1" };
          return null;
        }),
      },
      procedureType: { findFirst: jest.fn().mockResolvedValue({ id: "pt1", name: "Vanna", durationMin: 15 }) },
      resource: { findFirst: jest.fn().mockResolvedValue({ id: "res1" }) },
      clinicalEpisode: { findFirst: jest.fn().mockResolvedValue({ id: "ep-archive" }) },
      procedureOrder: {
        findFirst: jest.fn().mockResolvedValue({ id: "ord1", note: null, sites: [] }),
        update,
      },
    };
    await adapter.upsert(tx as never, row, false);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ord1" },
        data: expect.objectContaining({ clinicalEpisodeId: "ep-archive" }),
      }),
    );
  });

  it("re-Apply lab-orders stamps clinicalEpisodeId on existing LabOrder", async () => {
    const adapter = getImportAdapter("lab-orders")!;
    const mapped = adapter.mapRow({
      externalRef: "wo:lab:9",
      patientRef: "wo:patient:1",
      testCode: "LAB-CBC",
      status: "COMPLETED",
      panel: "QAN",
      takenAt: "2026-02-18",
    });
    const row = adapter.rowSchema.parse(mapped);
    const update = jest.fn();
    const tx = {
      cutoverImportKey: {
        findFirst: jest.fn(async ({ where }: { where: { entity: string } }) => {
          if (where.entity === "patients") return { recordId: "pat1" };
          if (where.entity === "lab-orders") return { recordId: "lab9" };
          return null;
        }),
      },
      diagnosticService: { findFirst: jest.fn().mockResolvedValue({ id: "svc1" }) },
      clinicalEpisode: { findFirst: jest.fn().mockResolvedValue({ id: "ep-archive" }) },
      labOrder: { create: jest.fn(), update },
    };
    await adapter.upsert(tx as never, row, false);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lab9" },
        data: expect.objectContaining({ clinicalEpisodeId: "ep-archive" }),
      }),
    );
  });

  it("re-Apply diagnostics stamps clinicalEpisodeId on existing LabOrder", async () => {
    const adapter = getImportAdapter("diagnostics")!;
    const mapped = adapter.mapRow({
      externalRef: "wo:usg:1",
      patientRef: "wo:patient:1",
      code: "USG-ABD",
      name: "USM",
      resultText: "",
      resultJson: "[]",
      takenAt: "2026-02-18",
    });
    const row = adapter.rowSchema.parse(mapped);
    const update = jest.fn();
    const tx = {
      cutoverImportKey: {
        findFirst: jest.fn(async ({ where }: { where: { entity: string } }) => {
          if (where.entity === "patients") return { recordId: "pat1" };
          if (where.entity === "diagnostics") return { recordId: "usg1" };
          return null;
        }),
      },
      clinicalEpisode: { findFirst: jest.fn().mockResolvedValue({ id: "ep-archive" }) },
      labOrder: { update },
      labOrderItem: { findFirst: jest.fn().mockResolvedValue({ id: "item1" }) },
      labResult: { deleteMany: jest.fn(), findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
    };
    await adapter.upsert(tx as never, row, false);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "usg1" },
        data: expect.objectContaining({ clinicalEpisodeId: "ep-archive" }),
      }),
    );
  });
});
