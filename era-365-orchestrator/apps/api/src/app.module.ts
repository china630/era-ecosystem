import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { EntitlementsModule } from "./entitlements/entitlements.module";
import { PrismaModule } from "./prisma/prisma.module";
import { SatelliteEventsModule } from "./satellite-events/satellite-events.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    EntitlementsModule,
    SatelliteEventsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
