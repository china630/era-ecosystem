import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
} from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { MdmService } from "./mdm.service";

@Public()
@Controller("portal/v1/mdm/access")
export class MdmConsentPortalController {
  constructor(private readonly mdm: MdmService) {}

  private sessionPersonId(auth?: string): string {
    const token = auth?.replace(/^Bearer\s+/i, "").trim();
    if (!token) throw new BadRequestException("Authorization required");
    return this.mdm.assertConsentPortalSession(token);
  }

  /** Exchange guest QR token for a short-lived consent portal session. */
  @Post("session")
  openSession(@Body() body: { token: string }) {
    if (!body.token?.trim()) {
      throw new BadRequestException("token required");
    }
    return this.mdm.createConsentPortalSession(body.token.trim());
  }

  @Get("requests")
  listRequests(@Headers("authorization") auth?: string) {
    const personId = this.sessionPersonId(auth);
    return this.mdm.listPendingAccessRequestsForPerson(personId);
  }

  @Post("requests/:requestId/decide")
  decide(
    @Param("requestId") requestId: string,
    @Body() body: { grant: boolean },
    @Headers("authorization") auth?: string,
  ) {
    const personId = this.sessionPersonId(auth);
    return this.mdm.decidePersonAccessRequest({
      requestId,
      globalPersonId: personId,
      grant: body.grant === true,
    });
  }
}
