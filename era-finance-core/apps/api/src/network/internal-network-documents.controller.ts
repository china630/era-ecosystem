import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { InternalServiceTokenGuard } from "../common/guards/internal-service-token.guard";
import { ReceiveNetworkDocumentDto } from "./dto/receive-network-document.dto";
import { InternalNetworkDocumentsService } from "./internal-network-documents.service";

@ApiTags("internal")
@Controller("internal/v1/network-documents")
@Public()
@UseGuards(InternalServiceTokenGuard)
export class InternalNetworkDocumentsController {
  constructor(private readonly internal: InternalNetworkDocumentsService) {}

  @Post("receive")
  @ApiOperation({ summary: "Receive cross-deploy network document (service token)" })
  receive(@Body() body: ReceiveNetworkDocumentDto) {
    return this.internal.receive(body);
  }
}
