import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PrismaModule } from "../prisma/prisma.module";
import { BuyerPortalController } from "./buyer-portal.controller";
import { BuyerPortalService } from "./buyer-portal.service";

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("ERA_JWT_SECRET") ?? "dev-buyer-jwt-secret-min16",
        signOptions: { expiresIn: "8h" },
      }),
    }),
  ],
  controllers: [BuyerPortalController],
  providers: [BuyerPortalService],
  exports: [BuyerPortalService],
})
export class BuyerPortalModule {}
