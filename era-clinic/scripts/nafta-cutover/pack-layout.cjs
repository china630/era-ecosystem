"use strict";

/**
 * Nafta READY pack layout (SSOT for filenames).
 * Checklist: D:\ERA-BACKUP\NAFTA-ERA-READY\IMPORT-CHECKLIST.md
 *
 * Blocks: 01–02 HR · 03–15 hotel · 16–29 clinic · 30–32 FnB · 33 retail · 34–47 1C
 */

const path = require("path");

const FILES = {
  hrOrg: "hr/01-Org-Structure.xlsx",
  hrEmployees: "hr/02-Employees.xlsx",
  hotelRevenue: "hotel/03-Revenue-Codes.xlsx",
  hotelBeds: "hotel/04-Bed-Types.xlsx",
  hotelViews: "hotel/05-Room-Views.xlsx",
  hotelRoomTypes: "hotel/06-Room-Types.xlsx",
  hotelRates: "hotel/07-Rate-Codes.xlsx",
  hotelRooms: "hotel/08-Rooms.xlsx",
  hotelAgencies: "hotel/09-Travel-Agencies.xlsx",
  hotelGuests: "hotel/10-Guest-Cards.xlsx",
  hotelReservations: "hotel/11-Reservations.xlsx",
  hotelNotes: "hotel/12-Reservation-Notes.xlsx",
  hotelFolioDir: "hotel/13-folio-parts",
  hotelPackageSell: "hotel/14-Package-Sell-2026.xlsx",
  hotelAgencyStatement: "hotel/15-Agency-Statement.xlsx",
  clinicCatalog: "clinic/16-Diagnostic-Lab-Catalog.xlsx",
  clinicPhysio: "clinic/17-Physio-Sites.xlsx",
  clinicTreatments: "clinic/19-Treatments.xlsx",
  clinicRooms: "clinic/20-Clinic-Rooms.xlsx",
  clinicRequirements: "clinic/21-Procedure-Requirements.xlsx",
  clinicDoctors: "clinic/22-Doctors.xlsx",
  clinicTemplates: "clinic/23-Program-Templates.xlsx",
  clinicPatients: "clinic/24-Patients.xlsx",
  clinicQuotas: "clinic/25-Quotas.xlsx",
  clinicSlots: "clinic/26-Slots.xlsx",
  /** Wizard also accepts 26-Slots-p01.xlsx … when the book is chunked. */
  clinicLabOrders: "clinic/27-Lab-Orders.xlsx",
  clinicLabResults: "clinic/28-Lab-Results.xlsx",
  clinicDiagnostics: "clinic/29-Diagnostics.xlsx",
  fnbGroups: "fnb/30-Product-Group-List.xlsx",
  fnbCards: "fnb/31-Product-Cards.xlsx",
  fnbTx: "fnb/32-FnB-Transactions.xlsx",
  retailStock: "retail/33-Stock-Cards.xlsx",
  c1Counterparties: "1c/38-1C-Counterparties.xlsx",
  c1FixedAssets: "1c/44-1C-Fixed-Assets.xlsx",
};

/** START-only archives (not wizard Apply books). */
const START_ARCHIVE = {
  folioMerged: "hotel/13-Folio-Transactions.merged.xlsx",
  folioHotel: "hotel/13-Folio-Transactions.hotel.xlsx",
  packageCsv: "hotel/14-Package-Prices-2026.csv",
  hizmetEw: "hotel/_not-ready/15-Hizmet-Tanimlari.source.xlsx",
  c1ConsumablesDocx: "1c/47-1C-Procedure-Consumables.docx",
};

const HOTEL_COPY_KEYS = [
  "hotelRevenue",
  "hotelBeds",
  "hotelViews",
  "hotelRoomTypes",
  "hotelRates",
  "hotelAgencies",
  "hotelGuests",
  "hotelReservations",
  "hotelAgencyStatement",
];

const FNB_COPY_KEYS = ["fnbGroups", "fnbCards", "fnbTx"];
const RETAIL_COPY_KEYS = ["retailStock"];
const C1_COPY_KEYS = ["c1Counterparties", "c1FixedAssets"];

function fileAt(root, rel) {
  return path.join(root, rel);
}

function readyFile(root, key) {
  return fileAt(root, FILES[key]);
}

const CLINIC_KEEP_CURATED = [
  "19-Treatments.xlsx",
  "20-Clinic-Rooms.xlsx",
  "21-Procedure-Requirements.xlsx",
  "22-Doctors.xlsx",
];

const CLINIC_WIZARD_BOOKS = [
  "16-Diagnostic-Lab-Catalog.xlsx",
  "17-Physio-Sites.xlsx",
  "19-Treatments.xlsx",
  "20-Clinic-Rooms.xlsx",
  "21-Procedure-Requirements.xlsx",
  "22-Doctors.xlsx",
  "23-Program-Templates.xlsx",
  "24-Patients.xlsx",
  "25-Quotas.xlsx",
  "26-Slots.xlsx",
  "27-Lab-Orders.xlsx",
  "28-Lab-Results.xlsx",
  "29-Diagnostics.xlsx",
];

module.exports = {
  FILES,
  START_ARCHIVE,
  HOTEL_COPY_KEYS,
  FNB_COPY_KEYS,
  RETAIL_COPY_KEYS,
  C1_COPY_KEYS,
  CLINIC_KEEP_CURATED,
  CLINIC_WIZARD_BOOKS,
  fileAt,
  readyFile,
};
