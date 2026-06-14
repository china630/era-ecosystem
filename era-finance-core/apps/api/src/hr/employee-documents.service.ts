import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { EmployeeDocumentKind } from "@erafinance/database";
import { PrismaService } from "../prisma/prisma.service";
import { serializeForAudit } from "../audit/audit-serialize";
import {
  STORAGE_SERVICE,
  type StorageService,
} from "../storage/storage.interface";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

@Injectable()
export class EmployeeDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  private async assertEmployee(organizationId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) throw new NotFoundException("Employee not found");
    return employee;
  }

  async list(organizationId: string, employeeId: string) {
    await this.assertEmployee(organizationId, employeeId);
    const rows = await this.prisma.employeeDocument.findMany({
      where: { organizationId, employeeId },
      orderBy: [{ createdAt: "desc" }],
      include: {
        uploadedByUser: { select: { id: true, email: true } },
      },
    });
    return rows.map((row) => serializeForAudit(row));
  }

  async upload(
    organizationId: string,
    employeeId: string,
    uploadedByUserId: string,
    kind: EmployeeDocumentKind,
    file: Express.Multer.File,
  ) {
    await this.assertEmployee(organizationId, employeeId);
    if (!file?.buffer?.length) {
      throw new BadRequestException("File is required");
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException("File too large (max 10 MB)");
    }

    const ext = (file.originalname.split(".").pop() || "bin").toLowerCase();
    const storageKey = `orgs/${organizationId}/hr/employees/${employeeId}/${randomUUID()}.${ext}`;
    await this.storage.putObject(storageKey, file.buffer, {
      contentType: file.mimetype,
    });

    const row = await this.prisma.employeeDocument.create({
      data: {
        organizationId,
        employeeId,
        kind,
        storageKey,
        fileName: file.originalname,
        contentType: file.mimetype || null,
        fileSizeBytes: BigInt(file.size),
        uploadedByUserId,
      },
      include: {
        uploadedByUser: { select: { id: true, email: true } },
      },
    });
    return serializeForAudit(row);
  }
}
