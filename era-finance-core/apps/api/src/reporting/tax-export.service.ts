import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Decimal,
  EmployeeKind,
  LedgerType,
  PayrollRunStatus,
  Prisma,
  TaxDeclarationExportStatus,
  TaxDeclarationType,
} from "@erafinance/database";
import ExcelJS from "exceljs";
import { endOfUtcDay, monthRangeUtc } from "./reporting-period.util";
import { PrismaService } from "../prisma/prisma.service";
import { PostingAccountResolver } from "../accounting/posting/posting-account-resolver.service";
import { STORAGE_SERVICE, type StorageService } from "../storage/storage.interface";
import type { GenerateTaxDeclarationDto } from "./dto/generate-tax-declaration.dto";
import { decodeOrganizationTaxId } from "../security/pii-crypto.util";
import { ProfitTaxService } from "./profit-tax.service";
import {
  PayrollWithholdingService,
  type PayrollWithholdingAggregate,
  type PayrollWithholdingLine,
} from "./payroll-withholding.service";
import { PropertyTaxService } from "./property-tax.service";

type DeclarationRecord = {
  id: string;
  taxType: string;
  period: string;
  status: TaxDeclarationExportStatus;
  generatedFileUrl: string;
  receiptFileUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function parseMonthPeriod(period: string): { year: number; month: number } {
  const m = period.match(/^(\d{4})-(\d{2})$/);
  if (!m) throw new BadRequestException("period must be in YYYY-MM format");
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw new BadRequestException("invalid period");
  }
  return { year, month };
}

function parseYearPeriod(period: string): number {
  if (!/^\d{4}$/.test(period)) {
    throw new BadRequestException("period must be YYYY");
  }
  const year = Number(period);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    throw new BadRequestException("invalid year");
  }
  return year;
}

@Injectable()
export class TaxExportService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    private readonly posting: PostingAccountResolver,
    private readonly profitTax: ProfitTaxService,
    private readonly payrollWithholding: PayrollWithholdingService,
    private readonly propertyTax: PropertyTaxService,
  ) {}

  async list(organizationId: string): Promise<DeclarationRecord[]> {
    return this.prisma.taxDeclarationExport.findMany({
      where: { organizationId },
      orderBy: [{ period: "desc" }, { createdAt: "desc" }],
    });
  }

  async aggregatePayrollWithholding(
    organizationId: string,
    period: string,
  ): Promise<PayrollWithholdingAggregate> {
    const { year, month } = parsePeriod(period);
    const { start, end } = monthRangeUtc(year, month);

    const run = await this.prisma.payrollRun.findFirst({
      where: {
        organizationId,
        year,
        month,
        status: PayrollRunStatus.POSTED,
      },
      include: {
        slips: {
          include: {
            employee: {
              select: {
                id: true,
                kind: true,
                globalPersonId: true,
              },
            },
          },
        },
      },
    });

    if (!run || run.slips.length === 0) {
      throw new BadRequestException(
        `No POSTED payroll run with slips for period ${period}`,
      );
    }

    const personIds = run.slips.map((s) => s.employee.globalPersonId);
    const [personMap, finMap] = await Promise.all([
      batchEmployeePersonMap(this.mdm, organizationId, personIds),
      batchComplianceFinMap(this.mdm, organizationId, personIds),
    ]);

    const employees: PayrollWithholdingLine[] = [];
    const contractors: PayrollWithholdingLine[] = [];

    for (const slip of run.slips) {
      const person = personMap.get(slip.employee.globalPersonId);
      const finSnap = finMap.get(slip.employee.globalPersonId);
      const displayName = `${person?.lastName ?? "—"} ${person?.firstName ?? "—"}`.trim();
      const kind =
        slip.employee.kind === EmployeeKind.CONTRACTOR ? "CONTRACTOR" : "EMPLOYEE";
      const line: PayrollWithholdingLine = {
        employeeId: slip.employee.id,
        kind,
        displayName,
        fin: finSnap?.fin ?? null,
        finNote: finSnap?.note ?? null,
        gross: slip.gross,
        incomeTax: slip.incomeTax,
        dsmfWorker: slip.dsmfWorker,
        dsmfEmployer: slip.dsmfEmployer,
        itsWorker: slip.itsWorker,
        itsEmployer: slip.itsEmployer,
        unemploymentWorker: slip.unemploymentWorker,
        unemploymentEmployer: slip.unemploymentEmployer,
        contractorSocialWithheld: slip.contractorSocialWithheld,
        pitTotal: linePit(slip),
        socialTotal: lineSocial(slip),
      };
      if (kind === "CONTRACTOR") {
        contractors.push(line);
      } else {
        employees.push(line);
      }
    }

    const all = [...employees, ...contractors];
    return {
      period,
      periodFrom: start.toISOString().slice(0, 10),
      periodTo: end.toISOString().slice(0, 10),
      employees,
      contractors,
      totals: {
        pitTotal: sumDecimal(all.map((l) => l.pitTotal)).toFixed(2),
        socialTotal: sumDecimal(all.map((l) => l.socialTotal)).toFixed(2),
        dsmfWorker: sumDecimal(all.map((l) => l.dsmfWorker)).toFixed(2),
        dsmfEmployer: sumDecimal(all.map((l) => l.dsmfEmployer)).toFixed(2),
        itsWorker: sumDecimal(all.map((l) => l.itsWorker)).toFixed(2),
        itsEmployer: sumDecimal(all.map((l) => l.itsEmployer)).toFixed(2),
        unemploymentWorker: sumDecimal(all.map((l) => l.unemploymentWorker)).toFixed(2),
        unemploymentEmployer: sumDecimal(all.map((l) => l.unemploymentEmployer)).toFixed(2),
        contractorSocialWithheld: sumDecimal(
          all.map((l) => l.contractorSocialWithheld),
        ).toFixed(2),
        grossTotal: sumDecimal(all.map((l) => l.gross)).toFixed(2),
      },
    };
  }

  private buildPayrollWithholdingXml(input: {
    orgTaxId: string;
    orgName: string;
    agg: PayrollWithholdingAggregate;
  }): string {
    const rowXml = (line: PayrollWithholdingLine) => `
    <EmployeeRow kind="${line.kind}">
      <EmployeeId>${line.employeeId}</EmployeeId>
      <FIN>${line.fin ?? ""}</FIN>
      ${line.finNote ? `<FINNote>${line.finNote}</FINNote>` : ""}
      <DisplayName>${line.displayName}</DisplayName>
      <GrossAZN>${line.gross.toFixed(2)}</GrossAZN>
      <PIT>${line.pitTotal.toFixed(2)}</PIT>
      <DSMFWorker>${line.dsmfWorker.toFixed(2)}</DSMFWorker>
      <DSMFEmployer>${line.dsmfEmployer.toFixed(2)}</DSMFEmployer>
      <ITSWorker>${line.itsWorker.toFixed(2)}</ITSWorker>
      <ITSEmployer>${line.itsEmployer.toFixed(2)}</ITSEmployer>
      <UnemploymentWorker>${line.unemploymentWorker.toFixed(2)}</UnemploymentWorker>
      <UnemploymentEmployer>${line.unemploymentEmployer.toFixed(2)}</UnemploymentEmployer>
      <ContractorSocialWithheld>${line.contractorSocialWithheld.toFixed(2)}</ContractorSocialWithheld>
      <SocialTotal>${line.socialTotal.toFixed(2)}</SocialTotal>
    </EmployeeRow>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<TaxDeclaration schemaVersion="1.0" target="e-taxes.gov.az">
  <DeclarationType>PAYROLL_WITHHOLDING</DeclarationType>
  <Period>${input.agg.period}</Period>
  <Taxpayer>
    <TaxId>${input.orgTaxId}</TaxId>
    <Name>${input.orgName}</Name>
  </Taxpayer>
  <ReportingWindow>
    <PeriodFrom>${input.agg.periodFrom}</PeriodFrom>
    <PeriodTo>${input.agg.periodTo}</PeriodTo>
  </ReportingWindow>
  <Employees>${input.agg.employees.map(rowXml).join("")}</Employees>
  <Contractors>${input.agg.contractors.map(rowXml).join("")}</Contractors>
  <Totals>
    <PITTotal>${input.agg.totals.pitTotal}</PITTotal>
    <SocialTotal>${input.agg.totals.socialTotal}</SocialTotal>
    <GrossTotal>${input.agg.totals.grossTotal}</GrossTotal>
  </Totals>
  <ComplianceNote>Unified payroll withholding report (PIT + DSMF/İTS/unemployment). Verify against official e-taxes schema before production submit.</ComplianceNote>
</TaxDeclaration>`;
  }

  private async buildPayrollWithholdingXlsxBuffer(input: {
    orgName: string;
    orgTaxId: string;
    agg: PayrollWithholdingAggregate;
  }): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = "ERA Finance";
    wb.created = new Date();
    const sheet = wb.addWorksheet("PayrollWithholding");
    sheet.columns = [
      { header: "Kind", key: "kind", width: 12 },
      { header: "Employee ID", key: "employeeId", width: 36 },
      { header: "FIN", key: "fin", width: 12 },
      { header: "FIN note", key: "finNote", width: 28 },
      { header: "Name", key: "name", width: 30 },
      { header: "Gross", key: "gross", width: 12 },
      { header: "PIT", key: "pit", width: 12 },
      { header: "DSMF W", key: "dW", width: 10 },
      { header: "DSMF E", key: "dE", width: 10 },
      { header: "İTS W", key: "iW", width: 10 },
      { header: "İTS E", key: "iE", width: 10 },
      { header: "Unemp W", key: "uW", width: 10 },
      { header: "Unemp E", key: "uE", width: 10 },
      { header: "Contr soc", key: "cSoc", width: 10 },
      { header: "Social total", key: "social", width: 14 },
    ];

    const rows = [...input.agg.employees, ...input.agg.contractors];
    for (const line of rows) {
      sheet.addRow({
        kind: line.kind,
        employeeId: line.employeeId,
        fin: line.fin ?? "",
        finNote: line.finNote ?? "",
        name: line.displayName,
        gross: Number(line.gross),
        pit: Number(line.pitTotal),
        dW: Number(line.dsmfWorker),
        dE: Number(line.dsmfEmployer),
        iW: Number(line.itsWorker),
        iE: Number(line.itsEmployer),
        uW: Number(line.unemploymentWorker),
        uE: Number(line.unemploymentEmployer),
        cSoc: Number(line.contractorSocialWithheld),
        social: Number(line.socialTotal),
      });
    }

    const summary = wb.addWorksheet("Summary");
    summary.addRows([
      { field: "Tax type", value: "PAYROLL_WITHHOLDING" },
      { field: "Taxpayer", value: input.orgName },
      { field: "VÖEN", value: input.orgTaxId },
      { field: "Period", value: input.agg.period },
      { field: "PIT total", value: input.agg.totals.pitTotal },
      { field: "Social total", value: input.agg.totals.socialTotal },
      { field: "Gross total", value: input.agg.totals.grossTotal },
    ]);

    const raw = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(raw) ? raw : Buffer.from(new Uint8Array(raw));
  }

  private buildProfitTaxXml(input: {
    orgTaxId: string;
    orgName: string;
    agg: Awaited<ReturnType<ProfitTaxService["aggregateProfitTax"]>>;
  }): string {
    const adjXml = input.agg.adjustments
      .map(
        (a) => `
    <Adjustment>
      <Code>${a.code}</Code>
      <Kind>${a.kind}</Kind>
      <Source>${a.source}</Source>
      <Description>${a.description}</Description>
      <AmountAZN>${a.amount}</AmountAZN>
    </Adjustment>`,
      )
      .join("");

    return `<?xml version="1.0" encoding="UTF-8"?>
<TaxDeclaration schemaVersion="1.0" target="e-taxes.gov.az">
  <DeclarationType>PROFIT_TAX</DeclarationType>
  <Period>${input.agg.year}</Period>
  <Taxpayer>
    <TaxId>${input.orgTaxId}</TaxId>
    <Name>${input.orgName}</Name>
  </Taxpayer>
  <ReportingWindow>
    <PeriodFrom>${input.agg.periodFrom}</PeriodFrom>
    <PeriodTo>${input.agg.periodTo}</PeriodTo>
  </ReportingWindow>
  <AccountingResultAZN>${input.agg.accountingResult}</AccountingResultAZN>
  <Adjustments>${adjXml}</Adjustments>
  <AdjustmentsTotalAZN>${input.agg.adjustmentsTotal}</AdjustmentsTotalAZN>
  <TaxableBaseAZN>${input.agg.taxableBase}</TaxableBaseAZN>
  <TaxRatePercent>${input.agg.taxRatePercent}</TaxRatePercent>
  <TaxAmountAZN>${input.agg.taxAmount}</TaxAmountAZN>
  <BookDepreciationAZN>${input.agg.bookDepreciationTotal}</BookDepreciationAZN>
  <TaxDepreciationAZN>${input.agg.taxDepreciationTotal}</TaxDepreciationAZN>
  <ComplianceNote>Corporate income tax (mənfəət vergisi) draft package. Verify against official e-taxes schema before production submit.</ComplianceNote>
</TaxDeclaration>`;
  }

  private async buildProfitTaxXlsxBuffer(input: {
    orgName: string;
    orgTaxId: string;
    agg: Awaited<ReturnType<ProfitTaxService["aggregateProfitTax"]>>;
  }): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = "ERA Finance";
    wb.created = new Date();
    const summary = wb.addWorksheet("ProfitTax");
    summary.addRows([
      ["Tax type", "PROFIT_TAX"],
      ["Taxpayer", input.orgName],
      ["VÖEN", input.orgTaxId],
      ["Year", input.agg.year],
      ["Accounting result", input.agg.accountingResult],
      ["Adjustments total", input.agg.adjustmentsTotal],
      ["Taxable base", input.agg.taxableBase],
      ["Rate %", input.agg.taxRatePercent],
      ["Tax amount", input.agg.taxAmount],
      ["Book depreciation", input.agg.bookDepreciationTotal],
      ["Tax depreciation", input.agg.taxDepreciationTotal],
    ]);
    const adj = wb.addWorksheet("Adjustments");
    adj.columns = [
      { header: "Code", key: "code", width: 24 },
      { header: "Kind", key: "kind", width: 12 },
      { header: "Source", key: "source", width: 22 },
      { header: "Description", key: "description", width: 40 },
      { header: "Amount", key: "amount", width: 14 },
    ];
    for (const a of input.agg.adjustments) {
      adj.addRow({
        code: a.code,
        kind: a.kind,
        source: a.source,
        description: a.description,
        amount: Number(a.amount),
      });
    }
    const raw = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(raw) ? raw : Buffer.from(new Uint8Array(raw));
  }

  private async aggregateSimplifiedTax(
    organizationId: string,
    period: string,
  ): Promise<{
    periodFrom: string;
    periodTo: string;
    revenueAzn: Decimal;
    simplifiedTaxAmountAzn: Decimal;
  }> {
    const { year, month } = parseMonthPeriod(period);
    const { start, end } = monthRangeUtc(year, month);
    const revenueCode = await this.posting.resolveAccountCode(organizationId, "SALES_REVENUE");
    const account = await this.prisma.account.findFirst({
      where: { organizationId, code: revenueCode, ledgerType: LedgerType.NAS },
      select: { id: true },
    });
    if (!account) {
      throw new BadRequestException(
        `Revenue account ${revenueCode} not found for organization`,
      );
    }

    const agg = await this.prisma.journalEntry.aggregate({
      where: {
        organizationId,
        accountId: account.id,
        ledgerType: LedgerType.NAS,
        transaction: { date: { gte: start, lte: endOfUtcDay(end) } },
      },
      _sum: { credit: true },
    });
    const revenueAzn = agg._sum.credit ?? new Prisma.Decimal(0);
    const simplifiedTaxAmountAzn = revenueAzn.mul(new Prisma.Decimal("0.02"));
    return {
      periodFrom: start.toISOString().slice(0, 10),
      periodTo: end.toISOString().slice(0, 10),
      revenueAzn,
      simplifiedTaxAmountAzn,
    };
  }

  private buildSimplifiedTaxXml(input: {
    orgTaxId: string;
    orgName: string;
    period: string;
    periodFrom: string;
    periodTo: string;
    revenueAzn: Decimal;
    simplifiedTaxAmountAzn: Decimal;
  }): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<TaxDeclaration schemaVersion="2.0" target="e-taxes.gov.az">
  <DeclarationType>SIMPLIFIED_TAX</DeclarationType>
  <Period>${input.period}</Period>
  <Taxpayer>
    <TaxId>${input.orgTaxId}</TaxId>
    <Name>${input.orgName}</Name>
  </Taxpayer>
  <Computation>
    <PeriodFrom>${input.periodFrom}</PeriodFrom>
    <PeriodTo>${input.periodTo}</PeriodTo>
    <RevenueAZN>${input.revenueAzn.toFixed(2)}</RevenueAZN>
    <TaxRatePercent>2.00</TaxRatePercent>
    <TaxAmountAZN>${input.simplifiedTaxAmountAzn.toFixed(2)}</TaxAmountAZN>
  </Computation>
  <ComplianceNote>Elektron Bildiriş uploaded separately after portal submission.</ComplianceNote>
</TaxDeclaration>`;
  }

  private async buildSimplifiedTaxXlsxBuffer(input: {
    orgName: string;
    orgTaxId: string;
    period: string;
    periodFrom: string;
    periodTo: string;
    revenueAzn: Decimal;
    simplifiedTaxAmountAzn: Decimal;
  }): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = "ERA Finance";
    wb.created = new Date();
    const sheet = wb.addWorksheet("SimplifiedTax");
    sheet.columns = [
      { header: "Field", key: "field", width: 32 },
      { header: "Value", key: "value", width: 48 },
    ];
    sheet.addRows([
      { field: "Tax type", value: "SIMPLIFIED_TAX" },
      { field: "Taxpayer name", value: input.orgName },
      { field: "Taxpayer VÖEN", value: input.orgTaxId },
      { field: "Period", value: input.period },
      { field: "Period from", value: input.periodFrom },
      { field: "Period to", value: input.periodTo },
      { field: "Revenue (AZN)", value: input.revenueAzn.toFixed(2) },
      { field: "Rate (%)", value: "2.00" },
      { field: "Tax amount (AZN)", value: input.simplifiedTaxAmountAzn.toFixed(2) },
    ]);
    const raw = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(raw) ? raw : Buffer.from(new Uint8Array(raw));
  }

  private buildPayrollWithholdingXml(input: {
    orgTaxId: string;
    orgName: string;
    agg: PayrollWithholdingAggregate;
  }): string {
    const rowXml = (line: PayrollWithholdingLine) => `
    <EmployeeRow kind="${line.kind}">
      <EmployeeId>${line.employeeId}</EmployeeId>
      <FIN>${line.fin ?? ""}</FIN>
      <DisplayName>${line.displayName}</DisplayName>
      <GrossAZN>${line.gross.toFixed(2)}</GrossAZN>
      <PIT>${line.pitTotal.toFixed(2)}</PIT>
      <DSMFWorker>${line.dsmfWorker.toFixed(2)}</DSMFWorker>
      <DSMFEmployer>${line.dsmfEmployer.toFixed(2)}</DSMFEmployer>
      <ITSWorker>${line.itsWorker.toFixed(2)}</ITSWorker>
      <ITSEmployer>${line.itsEmployer.toFixed(2)}</ITSEmployer>
      <UnemploymentWorker>${line.unemploymentWorker.toFixed(2)}</UnemploymentWorker>
      <UnemploymentEmployer>${line.unemploymentEmployer.toFixed(2)}</UnemploymentEmployer>
      <ContractorSocialWithheld>${line.contractorSocialWithheld.toFixed(2)}</ContractorSocialWithheld>
      <SocialTotal>${line.socialTotal.toFixed(2)}</SocialTotal>
      <SlipLineEarnings>${line.slipLineEarnings}</SlipLineEarnings>
      <SlipLineDeductions>${line.slipLineDeductions}</SlipLineDeductions>
    </EmployeeRow>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<TaxDeclaration schemaVersion="1.0" target="e-taxes.gov.az">
  <DeclarationType>PAYROLL_WITHHOLDING</DeclarationType>
  <Period>${input.agg.period}</Period>
  <Taxpayer>
    <TaxId>${input.orgTaxId}</TaxId>
    <Name>${input.orgName}</Name>
  </Taxpayer>
  <ReportingWindow>
    <PeriodFrom>${input.agg.periodFrom}</PeriodFrom>
    <PeriodTo>${input.agg.periodTo}</PeriodTo>
  </ReportingWindow>
  <Employees>${input.agg.employees.map(rowXml).join("")}</Employees>
  <Contractors>${input.agg.contractors.map(rowXml).join("")}</Contractors>
  <Totals>
    <PITTotal>${input.agg.totals.pitTotal}</PITTotal>
    <SocialTotal>${input.agg.totals.socialTotal}</SocialTotal>
    <GrossTotal>${input.agg.totals.grossTotal}</GrossTotal>
    <SlipLineEarningsTotal>${input.agg.totals.slipLineEarningsTotal}</SlipLineEarningsTotal>
    <SlipLineDeductionsTotal>${input.agg.totals.slipLineDeductionsTotal}</SlipLineDeductionsTotal>
  </Totals>
</TaxDeclaration>`;
  }

  private async buildPayrollWithholdingXlsxBuffer(input: {
    orgName: string;
    orgTaxId: string;
    agg: PayrollWithholdingAggregate;
  }): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("PayrollWithholding");
    sheet.columns = [
      { header: "Kind", key: "kind", width: 12 },
      { header: "Employee ID", key: "employeeId", width: 36 },
      { header: "FIN (masked)", key: "fin", width: 14 },
      { header: "Name", key: "name", width: 30 },
      { header: "Gross", key: "gross", width: 12 },
      { header: "PIT", key: "pit", width: 12 },
      { header: "Social total", key: "social", width: 14 },
      { header: "Line earnings", key: "earn", width: 12 },
      { header: "Line deductions", key: "ded", width: 14 },
    ];
    for (const line of [...input.agg.employees, ...input.agg.contractors]) {
      sheet.addRow({
        kind: line.kind,
        employeeId: line.employeeId,
        fin: line.fin ?? "",
        name: line.displayName,
        gross: Number(line.gross),
        pit: Number(line.pitTotal),
        social: Number(line.socialTotal),
        earn: Number(line.slipLineEarnings),
        ded: Number(line.slipLineDeductions),
      });
    }
    const summary = wb.addWorksheet("Summary");
    summary.addRows([
      ["Tax type", "PAYROLL_WITHHOLDING"],
      ["Taxpayer", input.orgName],
      ["VÖEN", input.orgTaxId],
      ["Period", input.agg.period],
      ["PIT total", input.agg.totals.pitTotal],
      ["Social total", input.agg.totals.socialTotal],
      ["Gross total", input.agg.totals.grossTotal],
    ]);
    const raw = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(raw) ? raw : Buffer.from(new Uint8Array(raw));
  }

  private buildProfitTaxXml(input: {
    orgTaxId: string;
    orgName: string;
    agg: Awaited<ReturnType<ProfitTaxService["aggregateProfitTax"]>>;
  }): string {
    const adjXml = input.agg.adjustments
      .map(
        (a) => `
    <Adjustment>
      <Code>${a.code}</Code>
      <Kind>${a.kind}</Kind>
      <Source>${a.source}</Source>
      <Description>${a.description}</Description>
      <AmountAZN>${a.amount}</AmountAZN>
    </Adjustment>`,
      )
      .join("");

    return `<?xml version="1.0" encoding="UTF-8"?>
<TaxDeclaration schemaVersion="1.0" target="e-taxes.gov.az">
  <DeclarationType>PROFIT_TAX</DeclarationType>
  <Period>${input.agg.year}</Period>
  <Taxpayer>
    <TaxId>${input.orgTaxId}</TaxId>
    <Name>${input.orgName}</Name>
  </Taxpayer>
  <Computation>
    <PeriodFrom>${input.agg.periodFrom}</PeriodFrom>
    <PeriodTo>${input.agg.periodTo}</PeriodTo>
    <AccountingResultAZN>${input.agg.accountingResult}</AccountingResultAZN>
    <AdjustmentsTotalAZN>${input.agg.adjustmentsTotal}</AdjustmentsTotalAZN>
    <TaxableBaseAZN>${input.agg.taxableBase}</TaxableBaseAZN>
    <TaxRatePercent>${input.agg.taxRatePercent}</TaxRatePercent>
    <TaxAmountAZN>${input.agg.taxAmount}</TaxAmountAZN>
  </Computation>
  <Adjustments>${adjXml}</Adjustments>
</TaxDeclaration>`;
  }

  private async buildProfitTaxXlsxBuffer(input: {
    orgName: string;
    orgTaxId: string;
    agg: Awaited<ReturnType<ProfitTaxService["aggregateProfitTax"]>>;
  }): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("ProfitTax");
    sheet.addRows([
      ["Tax type", "PROFIT_TAX"],
      ["Taxpayer", input.orgName],
      ["VÖEN", input.orgTaxId],
      ["Year", input.agg.year],
      ["Accounting result", input.agg.accountingResult],
      ["Adjustments total", input.agg.adjustmentsTotal],
      ["Taxable base", input.agg.taxableBase],
      ["Rate %", input.agg.taxRatePercent],
      ["Tax amount", input.agg.taxAmount],
    ]);
    const adj = wb.addWorksheet("Adjustments");
    adj.addRow(["Code", "Kind", "Source", "Description", "Amount"]);
    for (const a of input.agg.adjustments) {
      adj.addRow([a.code, a.kind, a.source, a.description, a.amount]);
    }
    const raw = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(raw) ? raw : Buffer.from(new Uint8Array(raw));
  }

  private buildPropertyTaxXml(input: {
    orgTaxId: string;
    orgName: string;
    agg: Awaited<ReturnType<PropertyTaxService["aggregatePropertyTax"]>>;
  }): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<TaxDeclaration schemaVersion="1.0" target="e-taxes.gov.az">
  <DeclarationType>PROPERTY_TAX</DeclarationType>
  <Period>${input.agg.year}</Period>
  <Taxpayer>
    <TaxId>${input.orgTaxId}</TaxId>
    <Name>${input.orgName}</Name>
  </Taxpayer>
  <Computation>
    <PeriodFrom>${input.agg.periodFrom}</PeriodFrom>
    <PeriodTo>${input.agg.periodTo}</PeriodTo>
    <NetBookTotalAZN>${input.agg.netBookTotal}</NetBookTotalAZN>
    <TaxRatePercent>${input.agg.ratePercent}</TaxRatePercent>
    <TaxAmountAZN>${input.agg.taxAmount}</TaxAmountAZN>
    <AssetCount>${input.agg.assetCount}</AssetCount>
    <RateNote>${input.agg.rateNote}</RateNote>
  </Computation>
</TaxDeclaration>`;
  }

  private async buildPropertyTaxXlsxBuffer(input: {
    orgName: string;
    orgTaxId: string;
    agg: Awaited<ReturnType<PropertyTaxService["aggregatePropertyTax"]>>;
  }): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("PropertyTax");
    sheet.addRows([
      ["Tax type", "PROPERTY_TAX"],
      ["Taxpayer", input.orgName],
      ["VÖEN", input.orgTaxId],
      ["Year", input.agg.year],
      ["Net book total", input.agg.netBookTotal],
      ["Rate %", input.agg.ratePercent],
      ["Tax amount", input.agg.taxAmount],
      ["Note", input.agg.rateNote],
    ]);
    const assets = wb.addWorksheet("Assets");
    assets.addRow([
      "Inventory #",
      "Name",
      "Purchase",
      "Booked dep.",
      "Net book",
    ]);
    for (const line of input.agg.lines) {
      assets.addRow([
        line.inventoryNumber,
        line.name,
        line.purchasePrice,
        line.bookedDepreciation,
        line.netBookValue,
      ]);
    }
    const raw = await wb.xlsx.writeBuffer();
    return Buffer.isBuffer(raw) ? raw : Buffer.from(new Uint8Array(raw));
  }

  private async storeAndCreate(
    organizationId: string,
    taxType: TaxDeclarationType,
    period: string,
    xml: string,
    xlsx: Buffer,
    computation: Record<string, unknown>,
  ) {
    const stamp = Date.now();
    const baseKey = `orgs/${organizationId}/tax-exports/${taxType}/${period}-${stamp}`;
    const xmlKey = `${baseKey}.xml`;
    const xlsxKey = `${baseKey}.xlsx`;
    await this.storage.putObject(xmlKey, Buffer.from(xml, "utf8"), {
      contentType: "application/xml",
    });
    await this.storage.putObject(xlsxKey, xlsx, {
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const created = await this.prisma.taxDeclarationExport.create({
      data: {
        organizationId,
        taxType,
        period,
        generatedFileUrl: xmlKey,
        status: TaxDeclarationExportStatus.GENERATED,
      },
    });

    return {
      ...created,
      artifacts: { xmlKey, xlsxKey },
      computation,
    };
  }

  async generate(organizationId: string, dto: GenerateTaxDeclarationDto) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, taxIdCipher: true },
    });
    if (!org) throw new NotFoundException("Organization not found");
    const orgTaxId = decodeOrganizationTaxId(org);
    if (!orgTaxId.trim()) {
      throw new BadRequestException("Organization tax ID is required");
    }

    if (dto.taxType === "SIMPLIFIED_TAX") {
      const agg = await this.aggregateSimplifiedTax(organizationId, dto.period);
      const xml = this.buildSimplifiedTaxXml({
        orgTaxId,
        orgName: org.name,
        period: dto.period,
        periodFrom: agg.periodFrom,
        periodTo: agg.periodTo,
        revenueAzn: agg.revenueAzn,
        simplifiedTaxAmountAzn: agg.simplifiedTaxAmountAzn,
      });
      const xlsx = await this.buildSimplifiedTaxXlsxBuffer({
        orgName: org.name,
        orgTaxId,
        period: dto.period,
        periodFrom: agg.periodFrom,
        periodTo: agg.periodTo,
        revenueAzn: agg.revenueAzn,
        simplifiedTaxAmountAzn: agg.simplifiedTaxAmountAzn,
      });
      return this.storeAndCreate(
        organizationId,
        TaxDeclarationType.SIMPLIFIED_TAX,
        dto.period,
        xml,
        xlsx,
        {
          revenueAzn: agg.revenueAzn.toFixed(2),
          simplifiedTaxAmountAzn: agg.simplifiedTaxAmountAzn.toFixed(2),
        },
      );
    }

    if (dto.taxType === "PROFIT_TAX") {
      const year = parseYearPeriod(dto.period);
      const agg = await this.profitTax.aggregateProfitTax(organizationId, year);
      const xml = this.buildProfitTaxXml({
        orgTaxId,
        orgName: org.name,
        agg,
      });
      const xlsx = await this.buildProfitTaxXlsxBuffer({
        orgName: org.name,
        orgTaxId,
        agg,
      });
      return this.storeAndCreate(
        organizationId,
        TaxDeclarationType.PROFIT_TAX,
        dto.period,
        xml,
        xlsx,
        {
          accountingResult: agg.accountingResult,
          taxableBase: agg.taxableBase,
          taxAmount: agg.taxAmount,
        },
      );
    }

    if (dto.taxType === "PAYROLL_WITHHOLDING") {
      const agg = await this.payrollWithholding.aggregate(
        organizationId,
        dto.period,
      );
      const xml = this.buildPayrollWithholdingXml({
        orgTaxId,
        orgName: org.name,
        agg,
      });
      const xlsx = await this.buildPayrollWithholdingXlsxBuffer({
        orgName: org.name,
        orgTaxId,
        agg,
      });
      return this.storeAndCreate(
        organizationId,
        TaxDeclarationType.PAYROLL_WITHHOLDING,
        dto.period,
        xml,
        xlsx,
        { totals: agg.totals },
      );
    }

    if (dto.taxType === "PROPERTY_TAX") {
      const year = parseYearPeriod(dto.period);
      const agg = await this.propertyTax.aggregatePropertyTax(
        organizationId,
        year,
      );
      const xml = this.buildPropertyTaxXml({
        orgTaxId,
        orgName: org.name,
        agg,
      });
      const xlsx = await this.buildPropertyTaxXlsxBuffer({
        orgName: org.name,
        orgTaxId,
        agg,
      });
      return this.storeAndCreate(
        organizationId,
        TaxDeclarationType.PROPERTY_TAX,
        dto.period,
        xml,
        xlsx,
        {
          netBookTotal: agg.netBookTotal,
          taxAmount: agg.taxAmount,
          ratePercent: agg.ratePercent,
        },
      );
    }

    throw new BadRequestException("Unsupported tax type");
  }

  async downloadGenerated(organizationId: string, exportId: string) {
    const row = await this.prisma.taxDeclarationExport.findFirst({
      where: { id: exportId, organizationId },
    });
    if (!row) throw new NotFoundException("Tax declaration export not found");

    const buffer = await this.storage.getObject(row.generatedFileUrl);
    if (row.status === TaxDeclarationExportStatus.GENERATED) {
      await this.prisma.taxDeclarationExport.update({
        where: { id: row.id },
        data: { status: TaxDeclarationExportStatus.UPLOADED },
      });
    }
    const isVat = row.taxType === TaxDeclarationType.VAT;
    const isPayroll =
      row.taxType === TaxDeclarationType.PAYROLL_WITHHOLDING ||
      row.taxType === TaxDeclarationType.SIMPLIFIED_TAX ||
      row.taxType === TaxDeclarationType.PROFIT_TAX;
    return {
      buffer,
      filename: isVat
        ? `${row.taxType}-${row.period}.json`
        : `${row.taxType}-${row.period}.xml`,
      contentType: isVat
        ? "application/json"
        : isPayroll
          ? "application/xml"
          : "application/xml",
    };
  }

  async attachReceipt(
    organizationId: string,
    exportId: string,
    file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException("PDF file is required");
    }
    const row = await this.prisma.taxDeclarationExport.findFirst({
      where: { id: exportId, organizationId },
    });
    if (!row) throw new NotFoundException("Tax declaration export not found");

    const key = `orgs/${organizationId}/tax-exports/${row.taxType}/${row.period}-receipt-${Date.now()}.pdf`;
    await this.storage.putObject(key, file.buffer, {
      contentType: file.mimetype || "application/pdf",
    });
    return this.prisma.taxDeclarationExport.update({
      where: { id: row.id },
      data: {
        receiptFileUrl: key,
        status: TaxDeclarationExportStatus.CONFIRMED_BY_TAX,
      },
    });
  }
}
