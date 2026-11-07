import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { EraJwtPayload } from "../auth/jwt-payload.type";
import { CommsService } from "./comms.service";
import { CreateCommsThreadDto, ReplyCommsThreadDto } from "./dto/comms.dto";

@ApiTags("comms")
@ApiBearerAuth("bearer")
@UseGuards(JwtAuthGuard)
@Controller("v1/comms")
export class CommsController {
  constructor(private readonly comms: CommsService) {}

  private requireOrg(user: EraJwtPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException("Organization context required");
    }
    return user.organizationId;
  }

  @Get("recipients")
  @ApiOperation({ summary: "List org members eligible as Comms recipients" })
  listRecipients(@CurrentUser() user: EraJwtPayload) {
    return this.comms.listRecipients(this.requireOrg(user), user.sub);
  }

  @Get("threads")
  @ApiOperation({ summary: "List Comms threads for the active org" })
  listThreads(@CurrentUser() user: EraJwtPayload) {
    return this.comms.listThreads(this.requireOrg(user), user.sub);
  }

  @Get("threads/:threadId")
  @ApiOperation({ summary: "Get a Comms thread with messages" })
  getThread(
    @CurrentUser() user: EraJwtPayload,
    @Param("threadId", ParseUUIDPipe) threadId: string,
  ) {
    return this.comms.getThread(this.requireOrg(user), user.sub, threadId);
  }

  @Post("threads")
  @ApiOperation({ summary: "Create a Comms thread with recipients" })
  createThread(
    @CurrentUser() user: EraJwtPayload,
    @Body() dto: CreateCommsThreadDto,
  ) {
    return this.comms.createThread(this.requireOrg(user), user.sub, dto);
  }

  @Post("threads/:threadId/reply")
  @ApiOperation({ summary: "Reply in a Comms thread" })
  reply(
    @CurrentUser() user: EraJwtPayload,
    @Param("threadId", ParseUUIDPipe) threadId: string,
    @Body() dto: ReplyCommsThreadDto,
  ) {
    return this.comms.reply(
      this.requireOrg(user),
      user.sub,
      threadId,
      dto.body,
    );
  }

  @Post("threads/:threadId/read")
  @ApiOperation({ summary: "Mark a Comms thread as read" })
  markRead(
    @CurrentUser() user: EraJwtPayload,
    @Param("threadId", ParseUUIDPipe) threadId: string,
  ) {
    return this.comms.markRead(this.requireOrg(user), user.sub, threadId);
  }
}
