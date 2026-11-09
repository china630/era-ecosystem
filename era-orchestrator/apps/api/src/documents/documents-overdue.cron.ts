import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { DocumentsService } from "./documents.service";

/** One overdue notice per open task, on the Baku day after dueAt has passed. */
@Injectable()
export class DocumentsOverdueCron {
  private readonly log = new Logger(DocumentsOverdueCron.name);

  constructor(private readonly documents: DocumentsService) {}

  @Cron("30 8 * * *", { timeZone: "Asia/Baku" })
  async morning(): Promise<void> {
    const sent = await this.documents.notifyOverdue();
    if (sent > 0) this.log.log(`document overdue notices: ${sent}`);
  }
}
