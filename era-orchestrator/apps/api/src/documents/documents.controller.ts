import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { EraJwtPayload } from "../auth/jwt-payload.type";
import { DocumentsService } from "./documents.service";
import {
  AddDocFileDto,
  CreateDocCaseDto,
  CreateDocLocationDto,
  CreateDocTemplateDto,
  DecideDocTaskDto,
  ListDocCasesQuery,
  PatchDocCaseDto,
  StartDocRouteDto,
  ArchiveDocCaseDto,
  AssignDocStepDto,
  SaveDocLayoutDto,
} from "./dto/documents.dto";

@ApiTags("documents")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard)
@Controller("v1/documents")
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  private org(user: EraJwtPayload): string {
    if (!user.organizationId) throw new ForbiddenException("Organization context required");
    return user.organizationId;
  }

  @Get("lookups")
  lookups(@CurrentUser() user: EraJwtPayload) {
    return this.documents.lookups(this.org(user), user.sub);
  }

  @Get("tasks/mine")
  myTasks(@CurrentUser() user: EraJwtPayload) {
    return this.documents.myTasks(this.org(user), user.sub);
  }

  @Get("tasks/overdue")
  overdue(@CurrentUser() user: EraJwtPayload) {
    return this.documents.listOverdue(this.org(user), user.sub);
  }

  @Post("tasks/assign")
  assign(@CurrentUser() user: EraJwtPayload, @Body() dto: AssignDocStepDto) {
    return this.documents.assign(this.org(user), user.sub, dto.caseId, dto.employmentId);
  }

  @Post("tasks/:taskId/decide")
  decide(
    @CurrentUser() user: EraJwtPayload,
    @Param("taskId", ParseUUIDPipe) taskId: string,
    @Body() dto: DecideDocTaskDto,
  ) {
    return this.documents.decide(this.org(user), user.sub, taskId, dto);
  }

  @Get("locations")
  locations(@CurrentUser() user: EraJwtPayload) {
    return this.documents.listLocations(this.org(user), user.sub);
  }

  @Post("locations")
  createLocation(@CurrentUser() user: EraJwtPayload, @Body() dto: CreateDocLocationDto) {
    return this.documents.createLocation(this.org(user), user.sub, dto);
  }

  @Delete("locations/:locationId")
  deleteLocation(
    @CurrentUser() user: EraJwtPayload,
    @Param("locationId", ParseUUIDPipe) locationId: string,
  ) {
    return this.documents.deleteLocation(this.org(user), user.sub, locationId);
  }

  @Get("templates")
  templates(@CurrentUser() user: EraJwtPayload) {
    return this.documents.listTemplates(this.org(user), user.sub);
  }

  @Post("templates")
  createTemplate(@CurrentUser() user: EraJwtPayload, @Body() dto: CreateDocTemplateDto) {
    return this.documents.createTemplate(this.org(user), user.sub, dto);
  }

  @Patch("templates/:templateId")
  updateTemplate(
    @CurrentUser() user: EraJwtPayload,
    @Param("templateId", ParseUUIDPipe) templateId: string,
    @Body() dto: CreateDocTemplateDto,
  ) {
    return this.documents.updateTemplate(this.org(user), user.sub, templateId, dto);
  }

  @Patch("templates/:templateId/layout")
  saveLayout(
    @CurrentUser() user: EraJwtPayload,
    @Param("templateId", ParseUUIDPipe) templateId: string,
    @Body() dto: SaveDocLayoutDto,
  ) {
    return this.documents.saveLayout(this.org(user), user.sub, templateId, dto.steps);
  }

  @Delete("templates/:templateId")
  deleteTemplate(
    @CurrentUser() user: EraJwtPayload,
    @Param("templateId", ParseUUIDPipe) templateId: string,
  ) {
    return this.documents.deleteTemplate(this.org(user), user.sub, templateId);
  }

  @Get("cases")
  cases(@CurrentUser() user: EraJwtPayload, @Query() query: ListDocCasesQuery) {
    return this.documents.listCases(this.org(user), user.sub, query);
  }

  @Post("cases")
  createCase(@CurrentUser() user: EraJwtPayload, @Body() dto: CreateDocCaseDto) {
    return this.documents.createCase(this.org(user), user.sub, dto);
  }

  @Get("cases/:caseId")
  getCase(@CurrentUser() user: EraJwtPayload, @Param("caseId", ParseUUIDPipe) caseId: string) {
    return this.documents.getCase(this.org(user), user.sub, caseId);
  }

  @Patch("cases/:caseId")
  patchCase(
    @CurrentUser() user: EraJwtPayload,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() dto: PatchDocCaseDto,
  ) {
    return this.documents.patchCase(this.org(user), user.sub, caseId, dto);
  }

  @Post("cases/:caseId/files")
  addFile(
    @CurrentUser() user: EraJwtPayload,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() dto: AddDocFileDto,
  ) {
    return this.documents.addFile(this.org(user), user.sub, caseId, dto);
  }

  @Patch("cases/:caseId/files/:fileId")
  replaceFile(
    @CurrentUser() user: EraJwtPayload,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Param("fileId", ParseUUIDPipe) fileId: string,
    @Body() dto: AddDocFileDto,
  ) {
    return this.documents.replaceFile(this.org(user), user.sub, caseId, fileId, dto.body ?? "");
  }

  @Post("cases/:caseId/register")
  register(@CurrentUser() user: EraJwtPayload, @Param("caseId", ParseUUIDPipe) caseId: string) {
    return this.documents.register(this.org(user), user.sub, caseId);
  }

  @Post("cases/:caseId/start")
  start(
    @CurrentUser() user: EraJwtPayload,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() dto: StartDocRouteDto,
  ) {
    return this.documents.start(this.org(user), user.sub, caseId, dto.templateId);
  }

  @Post("cases/:caseId/archive")
  archive(
    @CurrentUser() user: EraJwtPayload,
    @Param("caseId", ParseUUIDPipe) caseId: string,
    @Body() dto: ArchiveDocCaseDto,
  ) {
    return this.documents.archive(this.org(user), user.sub, caseId, dto.locationId);
  }
}
