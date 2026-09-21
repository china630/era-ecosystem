import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
} from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { assertMatchingServiceToken } from "../common/utils/internal-service-token.util";
import { LinkFinanceEmployeeDto } from "./dto/link-finance-employee.dto";
import { WorkforceRegistryService } from "./workforce-registry.service";

@Public()
@Controller("internal/v1/workforce")
export class WorkforceRegistryController {
  constructor(private readonly registry: WorkforceRegistryService) {}

  private assertToken(auth?: string, xServiceToken?: string) {
    assertMatchingServiceToken(auth, xServiceToken);
  }

  @Get("owners/:ownerUserId/assignments")
  listForOwner(
    @Param("ownerUserId", ParseUUIDPipe) ownerUserId: string,
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    this.assertToken(auth, xToken);
    return this.registry.listForOwner(ownerUserId);
  }

  @Get("organizations/:organizationId/assignments")
  listForOrg(
    @Param("organizationId", ParseUUIDPipe) organizationId: string,
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    this.assertToken(auth, xToken);
    return this.registry.listForOrganization(organizationId);
  }

  /**
   * Finance hire-mirror write-back: link Finance Employee.id onto CP WorkforceEmployment.
   * Evrostar wave 0 — required so absence / transfer / timesheet consumers can resolve Employee.
   */
  @Patch("employments/:employmentId/finance-link")
  linkFinanceEmployee(
    @Param("employmentId", ParseUUIDPipe) employmentId: string,
    @Body() body: LinkFinanceEmployeeDto,
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    this.assertToken(auth, xToken);
    return this.registry.linkFinanceEmployee(
      employmentId,
      body.financeEmployeeId,
    );
  }
}
