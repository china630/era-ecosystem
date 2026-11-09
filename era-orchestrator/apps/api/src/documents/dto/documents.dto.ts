import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import {
  DocDecisionOutcome,
  DocKind,
  DocLocationKind,
  DocStatus,
  DocStepAction,
  DocStepJoin,
  WorkforceApprovalStepAudience,
  WorkforceApprovalStepKind,
} from "@era365/database";

export class CreateDocCaseDto {
  @IsEnum(DocKind)
  kind!: DocKind;

  @IsString()
  @MaxLength(500)
  title!: string;

  @IsUUID()
  authorEmploymentId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  correspondent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  summary?: string;

  @IsOptional()
  @IsString()
  dueOn?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsUUID()
  orgUnitId?: string;

  @IsOptional()
  @IsUUID()
  replyToId?: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;
}

export class PatchDocCaseDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  correspondent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  summary?: string;

  @IsOptional()
  @IsString()
  dueOn?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number | null;

  @IsOptional()
  @IsUUID()
  orgUnitId?: string | null;

  @IsOptional()
  @IsUUID()
  replyToId?: string | null;

  @IsOptional()
  @IsUUID()
  templateId?: string | null;

  @IsOptional()
  @IsUUID()
  locationId?: string | null;
}

export class AddDocFileDto {
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  contentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  body?: string;
}

export class StartDocRouteDto {
  @IsOptional()
  @IsUUID()
  templateId?: string;
}

export class AssignDocStepDto {
  @IsUUID()
  caseId!: string;

  @IsUUID()
  employmentId!: string;
}

export class DecideDocTaskDto {
  @IsEnum(DocDecisionOutcome)
  outcome!: DocDecisionOutcome;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  reason?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  returnToStep?: number;
}

export class CreateDocLocationDto {
  @IsEnum(DocLocationKind)
  kind!: DocLocationKind;

  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class DocRouteStepDto {
  @IsInt()
  @Min(1)
  stepOrder!: number;

  @IsEnum(WorkforceApprovalStepKind)
  kind!: WorkforceApprovalStepKind;

  @IsEnum(DocStepAction)
  action!: DocStepAction;

  @IsOptional()
  @IsEnum(WorkforceApprovalStepAudience)
  appliesTo?: WorkforceApprovalStepAudience;

  @IsOptional()
  @IsInt()
  @Min(1)
  dueDays?: number;

  @IsOptional()
  @IsEnum(DocStepJoin)
  join?: DocStepJoin;

  @IsOptional()
  @IsEnum(DocKind)
  skipUnlessKind?: DocKind;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  chainOffset?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  minGradeLevel?: number;

  @IsOptional()
  @IsInt()
  layoutX?: number;

  @IsOptional()
  @IsInt()
  layoutY?: number;

  @IsOptional()
  @IsUUID()
  orgUnitId?: string;

  @IsOptional()
  @IsUUID()
  positionId?: string;
}

export class CreateDocTemplateDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsEnum(DocKind)
  docKind!: DocKind;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DocRouteStepDto)
  steps!: DocRouteStepDto[];
}

export class ArchiveDocCaseDto {
  @IsOptional()
  @IsUUID()
  locationId?: string;
}

export class LayoutPointDto {
  @IsInt()
  @Min(1)
  stepOrder!: number;

  @IsInt()
  layoutX!: number;

  @IsInt()
  layoutY!: number;
}

export class SaveDocLayoutDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LayoutPointDto)
  steps!: LayoutPointDto[];
}

export class ListDocCasesQuery {
  @IsOptional()
  @IsEnum(DocKind)
  kind?: DocKind;

  @IsOptional()
  @IsEnum(DocStatus)
  status?: DocStatus;

  @IsOptional()
  @IsUUID()
  orgUnitId?: string;
}
