import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Public } from "../auth/decorators/public.decorator";
import { PlacementJobService } from "./placement-job.service";

/**
 * Host-side agent poll. Orchestrator never SSHs to apply placement —
 * the agent on the target host pulls desired jobs and applies GitOps locally.
 */
@Public()
@Controller("v1/placement-agent")
export class PlacementAgentController {
  constructor(
    private readonly jobs: PlacementJobService,
    private readonly config: ConfigService,
  ) {}

  @Get("jobs")
  listPending(
    @Headers("authorization") authorization?: string,
  ) {
    this.assertHostToken(authorization);
    return this.jobs.listForHostAgent();
  }

  private assertHostToken(authorization?: string): void {
    const expected =
      this.config.get<string>("ERA_PLACEMENT_HOST_TOKEN")?.trim() ||
      this.config.get<string>("SATELLITE_EVENT_SERVICE_TOKEN")?.trim() ||
      "";
    if (!expected) {
      throw new UnauthorizedException("Placement host token not configured");
    }
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";
    if (!token || token !== expected) {
      throw new UnauthorizedException("Invalid placement host token");
    }
  }
}
