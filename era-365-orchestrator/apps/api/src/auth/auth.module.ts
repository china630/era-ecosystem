import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { MdmModule } from "../mdm/mdm.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { WellKnownController } from "./well-known.controller";

@Module({
  imports: [
    PrismaModule,
    MdmModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get<string>("ERA_JWT_SECRET") ??
          config.get<string>("JWT_SECRET") ??
          "dev-era-jwt-secret-change-me",
        signOptions: { algorithm: "HS256" },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, WellKnownController],
  providers: [AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
