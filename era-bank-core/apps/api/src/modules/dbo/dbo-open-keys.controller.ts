import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString, MinLength } from "class-validator";
import { ServiceTokenGuard } from "../../auth/bank-auth.guard";
import { DboOpenApiService } from "./dbo-open-api.service";

class RegisterOpenApiKeyDto {
  @IsString()
  @MinLength(1)
  id!: string;

  @IsString()
  @MinLength(1)
  keyHash!: string;

  @IsString()
  @MinLength(1)
  customerId!: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsArray()
  @IsString({ each: true })
  permissions!: string[];
}

@ApiTags("dbo-open-keys")
@UseGuards(ServiceTokenGuard)
@Controller("dbo/open/keys")
export class DboOpenKeysController {
  constructor(private readonly openApi: DboOpenApiService) {}

  @Get()
  list() {
    return {
      items: this.openApi.listRegistered().map((k) => ({
        id: k.id,
        customerId: k.customerId,
        organizationId: k.organizationId,
        permissions: k.permissions,
        revoked: Boolean(k.revoked),
      })),
    };
  }

  @Post("register")
  register(@Body() body: RegisterOpenApiKeyDto) {
    const row = this.openApi.registerKey({
      id: body.id,
      keyHash: body.keyHash,
      customerId: body.customerId,
      organizationId: body.organizationId,
      permissions: body.permissions,
    });
    return { id: row.id, customerId: row.customerId, permissions: row.permissions };
  }

  @Post(":id/revoke")
  revoke(@Param("id") id: string) {
    const ok = this.openApi.revokeKey(id);
    return { id, revoked: ok };
  }
}
