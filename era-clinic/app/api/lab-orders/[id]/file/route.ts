import { NextResponse } from "next/server";
import { jsonError, handleRouteError, getRouteSession, requireClinicRole } from "@/lib/api-utils";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import { prisma } from "@/lib/prisma";
import { readStoredLabFile } from "@/lib/import/lab-import-files";

function storedPathFromResultJson(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { storedPath?: string };
    return parsed.storedPath || null;
  } catch {
    return null;
  }
}

function contentTypeFor(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".doc")) return "application/msword";
  return "application/octet-stream";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getRouteSession();
    const denied = requireClinicRole(session, [
      CLINIC_ROLE.CLINIC_ADMIN,
      CLINIC_ROLE.DOCTOR,
      CLINIC_ROLE.NURSE,
      CLINIC_ROLE.LAB_TECH,
      CLINIC_ROLE.RECEPTION,
    ]);
    if (denied) return denied;

    const { id } = await params;
    const order = await prisma.labOrder.findUnique({
      where: { id },
      select: { id: true, resultJson: true },
    });
    if (!order) return jsonError("Lab order not found", 404);
    const storedPath = storedPathFromResultJson(order.resultJson);
    if (!storedPath) return jsonError("Lab file not imported", 404);
    const file = readStoredLabFile(storedPath);
    if (!file) return jsonError("Lab file missing on disk", 404);
    return new NextResponse(new Uint8Array(file.body), {
      status: 200,
      headers: {
        "Content-Type": contentTypeFor(file.fileName),
        "Content-Disposition": `attachment; filename="${file.fileName.replace(/"/g, "")}"`,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
