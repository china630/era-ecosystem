import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ActivityStreamEmitterService } from "./activity-stream-emitter.service";

/** CP: emitter only (billing audit side-effects). */
@Module({
  imports: [PrismaModule],
  providers: [ActivityStreamEmitterService],
  exports: [ActivityStreamEmitterService],
})
export class ActivityStreamModule {}
