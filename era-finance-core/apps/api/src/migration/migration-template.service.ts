import { BadRequestException, Injectable } from "@nestjs/common";
import {
  ALL_MIGRATION_UPLOAD_KINDS,
  TEMPLATE_SPECS,
  type MigrationUploadKind,
} from "./migration-kinds";
import { buildTemplateBuffer } from "./migration-xlsx.util";

@Injectable()
export class MigrationTemplateService {
  async templateBuffer(kind: string): Promise<{ filename: string; buffer: Buffer }> {
    if (!(ALL_MIGRATION_UPLOAD_KINDS as readonly string[]).includes(kind)) {
      throw new BadRequestException(`Unknown migration kind: ${kind}`);
    }
    const typed = kind as MigrationUploadKind;
    const spec = TEMPLATE_SPECS[typed];
    const buffer = await buildTemplateBuffer({
      sheetName: spec.sheet,
      columns: spec.columns,
      howto: spec.howto,
    });
    return { filename: `migration-${kind}.xlsx`, buffer };
  }
}
