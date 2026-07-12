import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { PublicVerifyController } from "./public-verify.controller";
import { SignatureService } from "./signature.service";
import {
  AsanSimaGovSignatureAdapter,
  GovSignatureAdapterFactory,
  MockGovSignatureAdapter,
} from "./gov-signature.adapters";

@Module({
  imports: [PrismaModule],
  controllers: [PublicVerifyController],
  providers: [
    SignatureService,
    MockGovSignatureAdapter,
    AsanSimaGovSignatureAdapter,
    GovSignatureAdapterFactory,
  ],
  exports: [SignatureService, GovSignatureAdapterFactory],
})
export class SignatureModule {}
