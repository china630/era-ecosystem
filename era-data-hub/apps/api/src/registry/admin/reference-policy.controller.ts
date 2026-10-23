import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { RegistryAuthGuard } from "../../auth/registry-auth.guard";
import { ReferencePolicyService } from "../../ingest/reference-policy.service";

class PolicyRowDto {
  @IsString()
  catalogKind!: string;

  @IsBoolean()
  externalFetchEnabled!: boolean;
}

class UpdateReferencePolicyDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PolicyRowDto)
  policies?: PolicyRowDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fxDashboardCurrencyCodes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fxCbarCheckCurrencyCodes?: string[];
}

@ApiTags("admin")
@ApiSecurity("service-token")
@UseGuards(RegistryAuthGuard)
@Controller("admin/reference-policy")
export class ReferencePolicyController {
  constructor(private readonly policy: ReferencePolicyService) {}

  @Get()
  @ApiOperation({ summary: "External-fetch switches and FX code lists" })
  async get() {
    return {
      policies: await this.policy.listPolicies(),
      fxDashboardCurrencyCodes: await this.policy.getFxDashboardCurrencyCodes(),
      fxCbarCheckCurrencyCodes: await this.policy.getFxCbarCheckCurrencyCodes(),
    };
  }

  @Patch()
  @ApiOperation({ summary: "Update external-fetch switches and FX code lists" })
  update(@Body() body: UpdateReferencePolicyDto) {
    return this.policy.save(body);
  }
}
