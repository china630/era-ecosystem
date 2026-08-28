const {
  HEADERS,
  procedureCode,
  roomCode,
  slotStatus,
  isOpsSlotDate,
  mapRosterRow,
  isUsgExam,
  labFileRel,
} = require("../scripts/nafta-cutover/map.cjs");

describe("nafta cutover column map", () => {
  it("exposes EN headers for clinic books and roster", () => {
    expect(HEADERS.procedures[0]).toBe("externalRef");
    expect(HEADERS.slots).toContain("status");
    expect(HEADERS.slots).toContain("nahiye");
    expect(HEADERS.labOrders).toContain("panel");
    expect(HEADERS.labResultLines).toContain("orderRef");
    expect(HEADERS.patients).toEqual([
      "externalRef",
      "woId",
      "fullName",
      "givenName",
      "surname",
      "sex",
      "birthDate",
      "nationality",
      "phone",
      "hotelResNo",
      "roomNumber",
      "folioPerson",
      "uniqueId",
      "checkIn",
      "checkOut",
      "treatmentDaysCount",
      "nightCount",
      "isReservationPatient",
      "doctorId",
      "doctorName",
      "doctorFormCreatedAt",
      "checkUpId",
      "checkUpName",
      "programCode",
      "latestPainDegree",
      "latestPainDegreeCreatedAt",
    ]);
    expect(HEADERS.roster).toEqual([
      "fin",
      "fullName",
      "orgUnit",
      "position",
      "hireDate",
      "satellites",
    ]);
  });

  it("maps WO Word analyte slugs to ERA seed codes", () => {
    const { eraAnalyteCode, eraPanelCode } = require("../scripts/nafta-cutover/wo-era-lab-map.cjs");
    expect(eraPanelCode("QAN")).toBe("LAB-CBC");
    expect(eraAnalyteCode("LYMPCT")).toBe("LYMPH%");
    expect(eraAnalyteCode("NEUT%")).toBe("NEUT%");
    expect(eraAnalyteCode("WBC")).toBe("WBC");
    expect(eraAnalyteCode("PCT")).toBe("PLT-PCT");
    expect(eraAnalyteCode("X_SUSI_KI")).toBe("U-SG");
    expect(eraAnalyteCode("T3")).toBe("TT3");
    const { eraCodeForWoAnalysis } = require("../scripts/nafta-cutover/wo-era-lab-map.cjs");
    expect(eraCodeForWoAnalysis(8)).toBe("LAB-SMEAR");
  });

  it("maps WO ids to stable external codes", () => {
    expect(procedureCode(10)).toBe("WO-TR-10");
    expect(roomCode(44)).toBe("WO-ROOM-44");
  });

  it("marks pre-cutover slots COMPLETED and ops week SCHEDULED", () => {
    expect(slotStatus("2026-08-24")).toBe("COMPLETED");
    expect(slotStatus("2026-08-25")).toBe("SCHEDULED");
    expect(isOpsSlotDate("2026-08-24")).toBe(false);
    expect(isOpsSlotDate("2026-08-25")).toBe(true);
    expect(isOpsSlotDate("2026-08-30")).toBe(true);
    expect(isOpsSlotDate("2026-08-31")).toBe(false);
  });

  it("detects USM from nested examination diagnoses", () => {
    expect(
      isUsgExam({
        notes: "abdomen",
        diagnoses: [{ diagnosisName: "USM" }],
      }),
    ).toBe(true);
    expect(labFileRel({ id: 57, fileName: "QAN.docx" })).toBe("dump/files/lab/57_QAN.docx");
  });

  it("maps medical job titles to clinic satellite", () => {
    const row = mapRosterRow({
      FİN: "4QK1E9C",
      "Tam adı": "Rəna Kəngərli",
      Şöbə: "Tibb",
      Vəzifə: "Baş həkim",
    });
    expect(row.satellites).toBe("industry_clinic");
    expect(row.fin).toBe("4QK1E9C");
  });

  it("joins calendar slots to card procedure nahiye", () => {
    const { slotNahiye } = require("../scripts/nafta-cutover/map.cjs");
    const map = new Map([[10, "boyun"]]);
    expect(slotNahiye({ patientProcedureId: 10 }, map)).toBe("boyun");
    expect(slotNahiye({ patientProcedureId: 99 }, map)).toBe("");
    expect(slotNahiye({}, map)).toBe("");
  });

  it("maps card gender Female to FEMALE not MALE", () => {
    const { mapSex, mapPatientImportRow } = require("../scripts/nafta-cutover/map.cjs");
    expect(mapSex("Female")).toBe("FEMALE");
    expect(mapSex("Male")).toBe("MALE");
    expect(mapSex("qadın")).toBe("FEMALE");
    const row = mapPatientImportRow(
      {
        id: 2148,
        fullName: "RAFIL KURBANOV",
        reservationId: null,
        reservationRoomNumber: "711",
        nationality: "Russian",
        phoneNumber: "",
        birthDate: "1970-04-13T00:00:00",
        doctorName: "Yoxdur",
        nightCount: 8,
        isReservationPatient: true,
      },
      {
        patient: {
          id: 2148,
          name: "RAFIL",
          surname: "KURBANOV",
          gender: "Male",
          nationality: "Russian",
          phoneNumber: "",
          birthDate: "1970-04-13T00:00:00",
          reservationId: 11112877,
          reservationRoomNumber: "711",
          folioPerson: 1,
          isReservationPatient: true,
          doctorId: 3,
          checkInDate: "2026-08-27T08:55:00",
          checkOutDate: "2026-09-04T12:00:00",
        },
        treatmentInfo: [],
      },
    );
    expect(row.sex).toBe("MALE");
    expect(row.hotelResNo).toBe("11112877");
    expect(row.givenName).toBe("RAFIL");
    expect(row.folioPerson).toBe(1);
  });
});
