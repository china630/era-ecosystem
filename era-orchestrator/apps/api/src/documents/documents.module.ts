import { Module } from "@nestjs/common";
import { CommsModule } from "../comms/comms.module";
import { WorkforceHubModule } from "../platform/workforce/workforce-hub.module";
import { PrismaModule } from "../prisma/prisma.module";
import { DocumentsController } from "./documents.controller";
import { DocumentsOverdueCron } from "./documents-overdue.cron";
import { DocumentsService } from "./documents.service";

@Module({
  imports: [PrismaModule, WorkforceHubModule, CommsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsOverdueCron],
})
export class DocumentsModule {}
