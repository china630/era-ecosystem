import { Global, Module, forwardRef } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { MdmModule } from "../mdm/mdm.module";
import { PrismaModule } from "../prisma/prisma.module";
import { ReferralsModule } from "../referrals/referrals.module";
import { SubscriptionTrialModule } from "../subscription/subscription-trial.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { HandoffTicketStore } from "./handoff-ticket.store";
import { WellKnownController } from "./well-known.controller";

@Global()
@Module({
  imports: [
    PrismaModule,
    forwardRef(() => MdmModule),
    ReferralsModule,
    SubscriptionTrialModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get<string>("ERA_JWT_SECRET") ??
          "dev-era-jwt-secret-change-me",
        signOptions: { algorithm: "HS256" },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, WellKnownController],
  providers: [AuthService, HandoffTicketStore, JwtAuthGuard],
  exports: [AuthService, JwtModule, JwtAuthGuard],
})
export class AuthModule {}
