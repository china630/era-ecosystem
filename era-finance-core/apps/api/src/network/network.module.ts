import { Module } from "@nestjs/common";
import { AccountingModule } from "../accounting/accounting.module";
import { InternalServiceTokenGuard } from "../common/guards/internal-service-token.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { NetworkDocumentPostingService } from "./network-document-posting.service";
import { NetworkDocumentService } from "./network-document.service";
import { NetworkDocumentsController } from "./network-documents.controller";
import { NetworkEqaimePrefillService } from "./network-eqaime-prefill.service";
import { InternalNetworkDocumentsController } from "./internal-network-documents.controller";
import { InternalNetworkDocumentsService } from "./internal-network-documents.service";
import { NetworkNettingService } from "./network-netting.service";
import { NetworkTenantMatchService } from "./network-tenant-match.service";
import { InProcessNetworkDocumentTransport } from "./transport/in-process-network-document-transport";
import { OrchestratorNetworkDocumentTransport } from "./transport/orchestrator-network-document-transport";

@Module({
  imports: [PrismaModule, AccountingModule],
  controllers: [NetworkDocumentsController, InternalNetworkDocumentsController],
  providers: [
    NetworkTenantMatchService,
    NetworkDocumentService,
    NetworkDocumentPostingService,
    NetworkNettingService,
    NetworkEqaimePrefillService,
    InternalNetworkDocumentsService,
    InProcessNetworkDocumentTransport,
    OrchestratorNetworkDocumentTransport,
    InternalServiceTokenGuard,
  ],
  exports: [NetworkDocumentService],
})
export class NetworkModule {}
