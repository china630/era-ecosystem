import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { SuperAdminGuard } from "../common/guards/super-admin.guard";
import { MdmService } from "./mdm.service";
import type { ResolvePersonInput } from "./mdm-person-identity.types";

@ApiTags("admin")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller("v1/admin/mdm")
export class AdminMdmController {
  constructor(private readonly mdm: MdmService) {}

  @Get("companies")
  @ApiOperation({ summary: "Paginated global legal entities (super-admin)" })
  listCompanies(
    @Query("page") pageRaw?: string,
    @Query("pageSize") pageSizeRaw?: string,
  ) {
    const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(pageSizeRaw ?? "25", 10) || 25),
    );
    return this.mdm.listLegalEntities({ page, pageSize });
  }

  @Get("persons")
  @ApiOperation({
    summary: "Paginated natural persons directory (super-admin)",
  })
  listPersons(
    @Query("page") pageRaw?: string,
    @Query("pageSize") pageSizeRaw?: string,
    @Query("fin") fin?: string,
    @Query("fullName") fullName?: string,
    @Query("phone") phone?: string,
    @Query("birthDate") birthDate?: string,
    @Query("includeMerged") includeMerged?: string,
  ) {
    const page = Math.max(1, Number.parseInt(pageRaw ?? "1", 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(pageSizeRaw ?? "25", 10) || 25),
    );
    return this.mdm.listNaturalPersons({
      page,
      pageSize,
      fin,
      fullName,
      phone,
      birthDate,
      includeMerged: includeMerged === "1" || includeMerged === "true",
    });
  }

  @Get("health")
  health() {
    return this.mdm.healthCheck();
  }

  @Post("persons/lookup-by-fin")
  @ApiOperation({ summary: "Lookup natural person by FIN (super-admin)" })
  lookupByFin(
    @Body() body: { fin: string; requesterOrgId?: string; purpose?: string },
  ) {
    return this.mdm.lookupNaturalPersonByFin(body);
  }

  @Post("persons/resolve")
  @ApiOperation({ summary: "Resolve or create person identity (super-admin)" })
  resolvePerson(@Body() body: ResolvePersonInput) {
    return this.mdm.resolvePersonIdentity(body);
  }

  @Post("persons/merge")
  @ApiOperation({ summary: "Merge duplicate persons (super-admin)" })
  mergePersons(
    @Body()
    body: {
      sourcePersonId: string;
      targetPersonId: string;
      actorOrgId?: string;
    },
  ) {
    return this.mdm.mergePersons(body);
  }

  @Get("persons/:personId/identifiers")
  @ApiOperation({ summary: "List person identifiers (super-admin)" })
  listIdentifiers(@Param("personId") personId: string) {
    return this.mdm.listPersonIdentifiers(personId);
  }
}
