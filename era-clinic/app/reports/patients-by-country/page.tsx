"use client";

import { CountryStayReport } from "@/components/reports/CountryStayReport";

export default function PatientsByCountryReportPage() {
  return <CountryStayReport origin="IN_HOUSE" titleKey="patientCountryReport" />;
}
