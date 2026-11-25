import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { GroupMemberRole, LoanLiabilityType } from "@era/bank-core-database";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { BankAuthGuard, type BankAuthRequest } from "../../auth/bank-auth.guard";
import { MfiService } from "./mfi.service";

class CreateGroupDto {
  @IsString() name!: string;
  @IsOptional() @IsEnum(LoanLiabilityType) liabilityType?: LoanLiabilityType;
  @IsOptional() @IsString() officerId?: string;
}

class AddMemberDto {
  @IsString() customerId!: string;
  @IsOptional() @IsEnum(GroupMemberRole) role?: GroupMemberRole;
}

class OriginateJlgBatchDto {
  @IsString() productTemplateId!: string;
  @IsString() principalMinorPerMember!: string;
  @IsOptional() @IsNumber() termMonths?: number;
  @IsOptional() @IsNumber() rateAnnual?: number;
}

class SheetLineDto {
  @IsString() customerId!: string;
  @IsOptional() @IsString() loanId?: string;
  @IsString() amountDueMinor!: string;
}

class CreateSheetDto {
  @IsDateString() meetingDate!: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SheetLineDto)
  lines?: SheetLineDto[];
}

class CollectLineDto {
  @IsString() customerId!: string;
  @IsOptional() @IsString() loanId?: string;
  @IsString() amountCollectedMinor!: string;
}

class CollectSheetDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CollectLineDto)
  lines!: CollectLineDto[];
}

@ApiTags("mfi")
@ApiBearerAuth()
@UseGuards(BankAuthGuard)
@Controller("mfi")
export class MfiController {
  constructor(private readonly mfi: MfiService) {}

  @Get("groups")
  listGroups() {
    return this.mfi.listGroups();
  }

  @Get("par30-by-officer")
  par30(@Query("officerId") officerId?: string) {
    return this.mfi.par30ByOfficer(officerId);
  }

  @Get("groups/:id")
  getGroup(@Param("id") id: string) {
    return this.mfi.getGroup(id);
  }

  @Post("groups")
  createGroup(@Body() body: CreateGroupDto) {
    return this.mfi.createGroup(body);
  }

  @Post("groups/:id/members")
  addMember(@Param("id") groupId: string, @Body() body: AddMemberDto) {
    return this.mfi.addMember({ groupId, ...body });
  }

  @Post("groups/:id/activate")
  activateGroup(@Param("id") groupId: string) {
    return this.mfi.activateGroup(groupId);
  }

  @Post("groups/:id/originate-jlg")
  originateJlg(
    @Req() req: BankAuthRequest,
    @Param("id") groupId: string,
    @Body() body: OriginateJlgBatchDto,
  ) {
    return this.mfi.originateJlgBatch({
      groupId,
      ...body,
      makerUserId: req.userId ?? "service",
    });
  }

  @Get("groups/:id/collection-sheets")
  listSheets(@Param("id") groupId: string) {
    return this.mfi.listCollectionSheets(groupId);
  }

  @Post("groups/:id/collection-sheets")
  createSheet(@Param("id") groupId: string, @Body() body: CreateSheetDto) {
    return this.mfi.createCollectionSheet({
      groupId,
      meetingDate: new Date(body.meetingDate),
      lines: body.lines,
    });
  }

  @Post("collection-sheets/:sheetId/collect")
  collect(
    @Req() req: BankAuthRequest,
    @Param("sheetId") sheetId: string,
    @Body() body: CollectSheetDto,
  ) {
    return this.mfi.collectSheet(sheetId, {
      lines: body.lines,
      makerUserId: req.userId ?? "mfi-officer",
    });
  }
}
