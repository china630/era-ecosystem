import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import {
  addEstimateDocument,
  approveEstimatePackage,
  createEstimatePackage,
  estimatePlanFact,
  getEstimatePackage,
  importEstimateLinesFromCsv,
  listEstimatePackages,
  replaceEstimateLines,
  setProjectEstimateMode,
  setProjectFinanceContractId,
  transitionEstimatePackage,
  ESTIMATE_DOC_KINDS,
  ESTIMATE_MODES,
  ESTIMATE_STATUSES,
} from "@/lib/estimate.service";
import { findProjectById } from "@/lib/projects.service";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { SATELLITE_CONSTRUCTION_ESTIMATE_PACKAGE_APPROVED } from "@era/contracts";
import type { StaffSession } from "@/lib/api-utils";
import { Staff } from "../decorators/staff-session.decorator";
import { ConstructionStaffGuard } from "../guards/staff.guard";
import { assertOk } from "../filters/construction-exception.filter";
import { withStaffTenant } from "../tenant";
import type { ConstructionRequest } from "../session";

const modeSchema = z.object({
  estimateMode: z.enum(ESTIMATE_MODES),
});

const financeContractSchema = z.object({
  financeContractId: z.string().max(64).nullable(),
});

const createPackSchema = z.object({
  title: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  financeContractId: z.string().max(64).optional(),
});

const csvImportSchema = z.object({
  csv: z.string().min(1).max(500_000),
});

const docSchema = z.object({
  kind: z.enum(ESTIMATE_DOC_KINDS),
  cipher: z.string().min(1).max(64),
  title: z.string().min(1).max(500),
  parentDocumentId: z.string().max(64).nullable().optional(),
  chapterNo: z.number().int().min(1).max(12).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

const linesSchema = z.object({
  lines: z
    .array(
      z.object({
        itemCode: z.string().min(1).max(64),
        description: z.string().min(1).max(500),
        unit: z.string().max(32).optional(),
        qty: z.number().positive(),
        unitRate: z.number().nonnegative().optional(),
        amountNet: z.number().nonnegative().optional(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .min(1),
});

const transitionSchema = z.object({
  status: z.enum(ESTIMATE_STATUSES),
});

@Controller("api")
@UseGuards(ConstructionStaffGuard)
export class EstimateController {
  @Get("projects/:id/estimate/packages")
  listPackages(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
  ) {
    return withStaffTenant(req, session, async () => {
      const project = await findProjectById(id);
      if (!project) throw new NotFoundException({ error: "Project not found" });
      return {
        estimateMode: project.estimateMode,
        financeContractId: project.financeContractId,
        packages: await listEstimatePackages(id),
      };
    });
  }

  @Get("projects/:id/estimate/plan-fact")
  planFact(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
  ) {
    return withStaffTenant(req, session, async () => {
      const result = await estimatePlanFact(id);
      if ("error" in result) assertOk(result);
      return result;
    });
  }

  @Patch("projects/:id/estimate/mode")
  setMode(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = modeSchema.parse(body ?? {});
      const result = await setProjectEstimateMode(id, parsed.estimateMode);
      return assertOk(result).project;
    });
  }

  @Patch("projects/:id/estimate/finance-contract")
  setFinanceContract(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = financeContractSchema.parse(body ?? {});
      const result = await setProjectFinanceContractId(
        id,
        parsed.financeContractId,
      );
      return assertOk(result).project;
    });
  }

  @Post("estimate-documents/:documentId/lines/import-csv")
  @HttpCode(200)
  importCsv(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("documentId") documentId: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = csvImportSchema.parse(body ?? {});
      const result = await importEstimateLinesFromCsv(documentId, parsed.csv);
      return assertOk(result).document;
    });
  }

  @Post("projects/:id/estimate/packages")
  @HttpCode(201)
  createPackage(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = createPackSchema.parse(body ?? {});
      const result = await createEstimatePackage(id, parsed);
      return assertOk(result).package;
    });
  }

  @Get("estimate-packages/:packageId")
  getPackage(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("packageId") packageId: string,
  ) {
    return withStaffTenant(req, session, async () => {
      const pack = await getEstimatePackage(packageId);
      if (!pack) throw new NotFoundException({ error: "Package not found" });
      return pack;
    });
  }

  @Post("estimate-packages/:packageId/documents")
  @HttpCode(201)
  addDocument(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("packageId") packageId: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = docSchema.parse(body ?? {});
      const result = await addEstimateDocument(packageId, parsed);
      return assertOk(result).document;
    });
  }

  @Put("estimate-documents/:documentId/lines")
  replaceLines(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("documentId") documentId: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = linesSchema.parse(body ?? {});
      const result = await replaceEstimateLines(documentId, parsed.lines);
      return assertOk(result).document;
    });
  }

  @Post("estimate-packages/:packageId/transition")
  transition(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("packageId") packageId: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = transitionSchema.parse(body ?? {});
      if (parsed.status === "APPROVED") {
        const result = await approveEstimatePackage(packageId);
        const approved = assertOk(result);
        const hint = approved.eventHint;
        if (hint) {
          await dispatchSatelliteEvent({
            type: SATELLITE_CONSTRUCTION_ESTIMATE_PACKAGE_APPROVED,
            payload: {
              projectId: hint.projectId,
              packageId: hint.packageId,
              version: hint.version,
              amountNet: hint.amountNet,
              currency: "AZN",
              financeContractId: hint.financeContractId,
              lineCount: hint.lineCount,
              lines: hint.lines,
            },
          });
        }
        // Wave-1 UI reads sovSeedEligible / financeContractId on the HTTP body (not only package).
        return {
          ...approved.package,
          sovSeedEligible: approved.sovSeedEligible,
          financeContractId: approved.financeContractId ?? null,
        };
      }
      const result = await transitionEstimatePackage(packageId, parsed.status);
      return assertOk(result).package;
    });
  }
}
