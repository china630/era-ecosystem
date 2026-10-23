import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { OrganizationId } from "../common/org-id.decorator";
import { ReferenceManualService } from "./reference-manual.service";

type SheetRow = Record<string, unknown>;

async function sheetRows(file?: Express.Multer.File): Promise<SheetRow[]> {
  if (!file?.buffer) throw new BadRequestException("file is required");
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(file.buffer as unknown as ArrayBuffer);
  const sheet = wb.worksheets[0];
  if (!sheet) throw new BadRequestException("workbook has no sheet");
  const header = (sheet.getRow(1).values as unknown[]).map((cell) => String(cell ?? "").trim());
  const rows: SheetRow[] = [];
  for (let r = 2; r <= sheet.rowCount; r += 1) {
    const line = sheet.getRow(r);
    const record: SheetRow = {};
    let any = false;
    for (let c = 1; c < header.length; c += 1) {
      const key = header[c];
      if (!key) continue;
      const value = line.getCell(c).text || line.getCell(c).value;
      if (value != null && String(value).trim() !== "") any = true;
      record[key] = value ?? "";
    }
    if (any) rows.push(record);
  }
  return rows;
}

@ApiTags("reference-manual")
@Controller("reference-manual")
export class ReferenceManualController {
  constructor(private readonly manual: ReferenceManualService) {}

  @Get("mode")
  @ApiOperation({ summary: "Whether this org reads data-hub or a local Excel copy" })
  mode(@OrganizationId() organizationId: string) {
    return { referenceSource: this.manual.usesExcel(organizationId) ? "excel" : "hub" };
  }

  @Get("fx-template.xlsx")
  @ApiOperation({ summary: "Excel template for manual FX rates" })
  async fxTemplate(@Res() res: Response) {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("fx");
    sheet.addRow(["currencyCode", "rate", "rateDate"]);
    sheet.addRow(["USD", 1.7, "2026-10-23"]);
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="fx-rates.xlsx"',
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.send(buf);
  }

  @Post("fx")
  @ApiConsumes("multipart/form-data")
  @ApiBody({ schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 2 * 1024 * 1024 } }))
  @ApiOperation({ summary: "Replace this org's manual FX rates from Excel" })
  async uploadFx(
    @OrganizationId() organizationId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const rows = this.manual.parseFxSheet(await sheetRows(file));
    return this.manual.replace(organizationId, "fx", rows);
  }

  @Post("banks")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 2 * 1024 * 1024 } }))
  @ApiOperation({ summary: "Replace this org's manual bank list from Excel" })
  async uploadBanks(
    @OrganizationId() organizationId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const parsed = (await sheetRows(file)).map((row) => ({
      code: String(row.code ?? "").trim(),
      nameAz: String(row.nameAz ?? row.name ?? "").trim(),
      voen: String(row.voen ?? "").trim(),
    })).filter((row) => row.code && row.nameAz);
    if (!parsed.length) throw new BadRequestException("No bank rows. Expected code, nameAz, voen.");
    return this.manual.replace(organizationId, "banks", parsed);
  }

  @Post("calendar")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 2 * 1024 * 1024 } }))
  @ApiOperation({ summary: "Replace this org's manual calendar from Excel" })
  async uploadCalendar(
    @OrganizationId() organizationId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const parsed = (await sheetRows(file)).map((row) => ({
      date: String(row.date ?? "").trim().slice(0, 10),
      isWorking: String(row.isWorking ?? "true").toLowerCase() !== "false",
      label: String(row.label ?? "").trim() || undefined,
    })).filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date));
    if (!parsed.length) throw new BadRequestException("No calendar rows. Expected date, isWorking.");
    return this.manual.replace(organizationId, "calendar", parsed);
  }

  @Post("hs")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 2 * 1024 * 1024 } }))
  @ApiOperation({ summary: "Replace this org's manual HS tariffs from Excel" })
  async uploadHs(
    @OrganizationId() organizationId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const parsed = (await sheetRows(file)).map((row) => ({
      hsCode: String(row.hsCode ?? row.code ?? "").replace(/\D/g, ""),
      dutyRatePercent: Number(row.dutyRatePercent ?? 0),
      vatRatePercent: Number(row.vatRatePercent ?? 0),
      excisePercent: Number(row.excisePercent ?? 0),
    })).filter((row) => row.hsCode);
    if (!parsed.length) {
      throw new BadRequestException("No HS rows. Expected hsCode, dutyRatePercent, vatRatePercent.");
    }
    return this.manual.replace(organizationId, "hs", parsed);
  }
}
