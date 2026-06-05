import { Module } from "@nestjs/common";
import { NetworkDocumentsController } from "./network-documents.controller";
import { NetworkDocumentsService } from "./network-documents.service";

@Module({
  controllers: [NetworkDocumentsController],
  providers: [NetworkDocumentsService],
  exports: [NetworkDocumentsService],
})
export class NetworkModule {}
