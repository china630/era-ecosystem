import "reflect-metadata";
import { Logger, RequestMethod, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { installBigIntJsonSerializer } from "./common/bigint-json";
import { PrismaService } from "./prisma/prisma.service";

installBigIntJsonSerializer();

async function bootstrap() {
  const logger = new Logger("BankCoreBootstrap");
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Sync / desired-state contract is `/api/internal/v1/*` (same as Finance + industry
  // Next satellites). Domain APIs stay under `/api/v1/*`.
  app.setGlobalPrefix("api/v1", {
    exclude: [
      "api/health",
      "health",
      "healthz",
      { path: "api/internal/(.*)", method: RequestMethod.ALL },
    ],
  });

  const swagger = new DocumentBuilder()
    .setTitle("ERA Bank Core API")
    .setDescription("Headless regulated banking engine")
    .setVersion("1.0.0")
    .addBearerAuth({ type: "http", scheme: "bearer" }, "bearer")
    .addBearerAuth({ type: "http", scheme: "bearer" }, "service-token")
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, swagger));

  try {
    const prisma = app.get(PrismaService);
    const { onSatelliteBoot } = await import("@era/satellite-kit");
    const result = await onSatelliteBoot({ prisma: prisma as never });
    if (result.organizationId) {
      logger.log(
        `organization bind hydrated source=${result.source} org=${result.organizationId}`,
      );
    } else {
      logger.warn(
        "organization bind not set at boot (Sync or env required in production)",
      );
    }
  } catch (err) {
    logger.error("onSatelliteBoot failed", err instanceof Error ? err.stack : err);
  }

  const port = process.env.API_PORT ?? "4300";
  await app.listen(Number(port), "0.0.0.0");
  logger.log(`ERA Bank Core http://0.0.0.0:${port}/api/v1  health /api/health  docs /api/v1/docs`);
}

bootstrap();
