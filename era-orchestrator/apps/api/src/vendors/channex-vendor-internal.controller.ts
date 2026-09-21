import { Controller, Get, Headers } from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { assertMatchingServiceToken } from "../common/utils/internal-service-token.util";
import { ChannexVendorService } from "./channex-vendor.service";

@Public()
@Controller("internal/v1/vendors/channex")
export class ChannexVendorInternalController {
  constructor(private readonly channex: ChannexVendorService) {}

  private guard(auth?: string, xToken?: string) {
    assertMatchingServiceToken(auth, xToken);
  }

  /** Satellite client-config — includes API key material; never log response. */
  @Get("client-config")
  async clientConfig(
    @Headers("authorization") auth?: string,
    @Headers("x-service-token") xToken?: string,
  ) {
    this.guard(auth, xToken);
    return this.channex.getClientMaterial();
  }
}
