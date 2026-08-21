import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PrismaModule } from "../prisma/prisma.module";
import { AgencyPortalController } from "./agency-portal.controller";
import { AgencyPortalService } from "./agency-portal.service";

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("ERA_JWT_SECRET") ?? "dev-agency-jwt-secret-min16",
        signOptions: { expiresIn: "8h" },
      }),
    }),
  ],
  controllers: [AgencyPortalController],
  providers: [AgencyPortalService],
  exports: [AgencyPortalService],
})
export class AgencyPortalModule {}
