import { Module } from "@nestjs/common";
import { PsaController } from "./psa.controller";
import { PsaService } from "./psa.service";

@Module({
  controllers: [PsaController],
  providers: [PsaService],
  exports: [PsaService],
})
export class PsaModule {}
