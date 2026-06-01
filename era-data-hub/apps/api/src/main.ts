import "reflect-metadata";
import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { HttpApiExceptionFilter } from "./common/http-api-exception.filter";
import { HEALTH_CHECK_PAYLOAD } from "./common/health-payload";

async function bootstrap() {
  const logger = new Logger("DataHubBootstrap");
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  app.use((req, res, next) => {
    const path = (req.url ?? "").split("?")[0];
    if (path === "/health" || path === "/healthz") {
      res.status(200).json(HEALTH_CHECK_PAYLOAD);
      return;
    }
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpApiExceptionFilter());
  app.setGlobalPrefix("registry/v1");

  const swagger = new DocumentBuilder()
    .setTitle("ERA Data Hub API")
    .setDescription("Reference Data / DaaS — data.era-365.online")
    .setVersion("1.0.0")
    .addApiKey({ type: "apiKey", name: "X-Api-Key", in: "header" }, "api-key")
    .addBearerAuth({ type: "http", scheme: "bearer" }, "service-token")
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, swagger));

  const port = process.env.API_PORT ?? "4200";
  await app.listen(Number(port), "0.0.0.0");
  logger.log(`ERA Data Hub http://0.0.0.0:${port}/registry/v1  health /healthz  docs /registry/v1/docs`);
}

bootstrap();
