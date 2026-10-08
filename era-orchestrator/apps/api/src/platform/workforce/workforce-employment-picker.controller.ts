import { Controller, Get, Headers, Param, ParseUUIDPipe } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../../auth/decorators/public.decorator";
import { assertMatchingServiceToken } from "../../common/utils/internal-service-token.util";
import { WorkforceEmploymentsService } from "./workforce-employments.service";

/**
 * Satellite staff picker. Operational cadre lives on CP employments;
 * finance Employee is the payroll mirror only.
 */
@ApiTags("internal-workforce")
@Public()
@Controller("internal/v1/workforce")
export class WorkforceEmploymentPickerController {
  constructor(private readonly employments: WorkforceEmploymentsService) {}

  @Get("organizations/:organizationId/picker")
  @ApiOperation({
    summary: "S2S: active CP employments for a satellite staff picker (display name, no rates)",
  })
  picker(
    @Param("organizationId", ParseUUIDPipe) organizationId: string,
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    assertMatchingServiceToken(auth, xToken);
    return this.employments.listPicker(organizationId);
  }
}
