import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { installBigIntJsonSerializer } from "./common/bigint-json";

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

  app.setGlobalPrefix("api/v1", { exclude: ["api/health", "health", "healthz"] });

  const swagger = new DocumentBuilder()
    .setTitle("ERA Bank Core API")
    .setDescription("Headless regulated banking engine")
    .setVersion("1.0.0")
    .addBearerAuth({ type: "http", scheme: "bearer" }, "bearer")
    .addBearerAuth({ type: "http", scheme: "bearer" }, "service-token")
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, swagger));

  const port = process.env.API_PORT ?? "4300";
  await app.listen(Number(port), "0.0.0.0");
  logger.log(`ERA Bank Core http://0.0.0.0:${port}/api/v1  health /api/health  docs /api/v1/docs`);
}

bootstrap();
