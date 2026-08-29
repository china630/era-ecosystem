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
      "passport",
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
      "sex",
      "birthDate",
      "orgUnit",
      "position",
      "hireDate",
      "workplace",
      "satellites",
    ]);
    expect(HEADERS.orgStructure).toEqual(["orgUnit", "position", "totalSlots"]);
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
      Cinsi: "Q",
    });
    expect(row.satellites).toBe("industry_clinic");
    expect(row.fin).toBe("4QK1E9C");
    expect(row.sex).toBe("FEMALE");
    expect(row.workplace).toBe("");
  });

  it("maps HR K/Q sex and ADDITIONAL workplace without satellites", () => {
    const { mapSex, mapWorkplace, mapOrgStructureRow } = require("../scripts/nafta-cutover/map.cjs");
    expect(mapSex("K")).toBe("MALE");
    expect(mapSex("Q")).toBe("FEMALE");
    expect(mapWorkplace("ƏSAS")).toBe("PRIMARY");
    expect(mapWorkplace("ƏLAVƏ")).toBe("ADDITIONAL");
    const extra = mapRosterRow({
      FİN: "1A2B3C4",
      "Tam adı": "Dual Job",
      Şöbə: "Tibb",
      Vəzifə: "Həkim",
      "İş yeri: əsas və ya əlavə": "ƏLAVƏ",
      Cinsi: "K",
    });
    expect(extra.workplace).toBe("ADDITIONAL");
    expect(extra.satellites).toBe("");
    expect(extra.sex).toBe("MALE");
    expect(
      mapOrgStructureRow({
        Şöbə: "Resepşn",
        Vəzifə: "Qeydiyyatçı",
        "Ştat vahidi": 2,
      }),
    ).toEqual({ orgUnit: "Resepşn", position: "Qeydiyyatçı", totalSlots: 2 });
  });

  it("maps HR Excel serials and dotted AZ dates to YYYY-MM-DD", () => {
    const { excelDateYmd } = require("../scripts/nafta-cutover/excel-date.cjs");
    expect(excelDateYmd(28019)).toBe("1976-09-16");
    expect(excelDateYmd(46154)).toBe("2026-05-12");
    expect(excelDateYmd("07.06.2024")).toBe("2024-06-07");
    expect(excelDateYmd("NAN")).toBe("");
    expect(excelDateYmd(0)).toBe("");
    const row = mapRosterRow({
      FİN: "119TS86",
      "Tam adı": "Nəzərov Nail Nizami oğlu",
      Şöbə: "Əyləncə",
      Vəzifə: "Əyləncə üzrə menecer",
      "Doğum tarixi": 28019,
      "İşə qəbul  tarixi": 46154,
    });
    expect(row.hireDate).toBe("2026-05-12");
    expect(row.birthDate).toBe("1976-09-16");
    expect(row.hireDate).not.toBe("2020-01-01");
    const dotted = mapRosterRow({
      FİN: "5DL988R",
      "Tam adı": "Süleymanova",
      "İşə qəbul  tarixi": "07.06.2024",
      "Doğum tarixi": 27363,
    });
    expect(dotted.hireDate).toBe("2024-06-07");
    expect(dotted.birthDate).toBe("1974-11-30");
    expect(excelDateYmd("1976-09-16T04:00:00.000Z")).toBe("1976-09-16");
  });

  it("writes roster sex and YYYY-MM-DD date strings (no ISO timestamps)", () => {
    const fs = require("fs");
    const os = require("os");
    const path = require("path");
    const XLSX = require("xlsx");
    const { writeRosterSheet } = require("../scripts/nafta-cutover/build-hr-roster.cjs");
    const tmp = path.join(os.tmpdir(), `era-hr-roster-${Date.now()}.xlsx`);
    writeRosterSheet(XLSX, tmp, HEADERS.roster, [
      {
        fin: "119TS86",
        fullName: "Nəzərov Nail Nizami oğlu",
        sex: "MALE",
        birthDate: "1976-09-16",
        orgUnit: "Əyləncə",
        position: "Əyləncə üzrə menecer",
        hireDate: "2026-05-12",
        workplace: "PRIMARY",
        satellites: "",
      },
    ]);
    const wb = XLSX.readFile(tmp, { cellDates: false });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: true });
    fs.unlinkSync(tmp);
    expect(rows[0].sex).toBe("MALE");
    expect(rows[0].birthDate).toBe("1976-09-16");
    expect(rows[0].hireDate).toBe("2026-05-12");
    expect(String(rows[0].birthDate)).not.toMatch(/T/);
    expect(String(rows[0].hireDate)).not.toMatch(/T/);
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
