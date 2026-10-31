import { MigrationUploadService } from "../src/migration/migration-upload.service";

describe("Migration machine master keys (AC-FIN-MIG)", () => {
  it("rejects duplicate product sku without updating", async () => {
    const created: unknown[] = [];
    const products = {
      create: async (args: unknown) => {
        created.push(args);
        return { id: "p1" };
      },
    };
    const prisma = {
      organization: {
        findFirst: async () => ({ migrationAssembledAt: null }),
      },
      migrationUploadLog: { create: async () => ({ id: "log1" }) },
      product: {
        findFirst: async () => ({ id: "existing" }),
      },
    };
    const svc = new MigrationUploadService(
      prisma as never,
      {} as never,
      products as never,
    );

    // Minimal XLSX is hard here — assert service path via private-like uploadMaster
    // by calling upload with a fake file that parse will reject, OR spy products.create.
    // Direct contract: existing sku must not call products.create.
    const xlsx = await import("exceljs");
    const wb = new xlsx.Workbook();
    const sheet = wb.addWorksheet("products");
    sheet.addRow([
      "sku",
      "name",
      "price",
      "vatRate",
      "isService",
      "revenueAccountCode",
      "category",
    ]);
    sheet.addRow(["TEA-01", "Tea", 4, 18, "false", "601", "Drinks"]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    const result = await svc.upload({
      organizationId: "org-1",
      userId: "u1",
      kind: "products",
      file: {
        buffer,
        originalname: "products.xlsx",
        mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: buffer.length,
      } as Express.Multer.File,
    });

    expect(created.length).toBe(0);
    expect(result.errors).toBeGreaterThan(0);
    expect(result.created).toBe(0);
  });
});
