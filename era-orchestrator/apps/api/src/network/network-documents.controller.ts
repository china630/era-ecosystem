import { Body, Controller, Headers, Post } from "@nestjs/common";
import { assertInternalServiceToken } from "../common/utils/internal-service-token.util";
import {
  NetworkDocumentsService,
  type NetworkDocumentDeliverPayload,
} from "./network-documents.service";

@Controller("internal/v1/network-documents")
export class NetworkDocumentsController {
  constructor(private readonly network: NetworkDocumentsService) {}

  @Post("deliver")
  deliver(
    @Body() body: NetworkDocumentDeliverPayload,
    @Headers("authorization") auth?: string,
  ) {
    assertInternalServiceToken(auth, "ORCHESTRATOR_INTERNAL_SERVICE_TOKEN");
    return this.network.deliver(body);
  }
}
