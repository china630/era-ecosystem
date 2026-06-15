import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("health")
@Controller()
export class HealthController {
  @Get(["api/health", "health", "healthz"])
  health() {
    return { status: "ok", service: "era-bank-core" };
  }
}
