import fs from "fs";
import path from "path";

const DEFAULT_START = path.join("D:", "ERA-BACKUP", "NAFTA-START");

export function naftaStartRoot(): string {
  return process.env.NAFTA_START || DEFAULT_START;
}

export function clinicDataRoot(): string {
  return process.env.ERA_CLINIC_DATA || path.join(naftaStartRoot(), "clinic");
}

function labDumpDir(): string {
  return path.join(naftaStartRoot(), "clinic", "dump", "files", "lab");
}

let dumpIndex: Map<string, string> | null = null;

/** Map WebOnly lab result id → absolute path under dump/files/lab. */
export function labDumpIndexById(): Map<string, string> {
  if (dumpIndex) return dumpIndex;
  dumpIndex = new Map();
  const dir = labDumpDir();
  if (!fs.existsSync(dir)) return dumpIndex;
  for (const name of fs.readdirSync(dir)) {
    if (name === "manifest.json" || name === "broken-ids.json") continue;
    const m = name.match(/^(\d+)_/);
    if (!m) continue;
    dumpIndex.set(m[1], path.join(dir, name));
  }
  return dumpIndex;
}

export function resetLabDumpIndex(): void {
  dumpIndex = null;
}

function orderIdFromRel(fileRel: string): string | null {
  const base = path.basename(fileRel.replace(/\\/g, "/"));
  const m = base.match(/^(\d+)_/);
  return m ? m[1] : null;
}

export function isLabBinaryBuffer(buf: Buffer): boolean {
  if (!buf || buf.length < 8) return false;
  if (buf[0] === 0x50 && buf[1] === 0x4b) return true;
  if (buf.slice(0, 5).toString("ascii") === "%PDF-") return true;
  return false;
}

function isUsableLabFile(abs: string): boolean {
  if (!abs || !fs.existsSync(abs)) return false;
  const st = fs.statSync(abs);
  if (!st.isFile() || st.size < 1024) return false;
  const buf = Buffer.alloc(8);
  const fd = fs.openSync(abs, "r");
  fs.readSync(fd, buf, 0, 8, 0);
  fs.closeSync(fd);
  return isLabBinaryBuffer(buf);
}

/** Resolve dump/files/lab/{id}_{name} (and legacy files/lab/…) to an absolute path, or null. */
export function resolveLabSourcePath(fileRel: string): string | null {
  const rel = fileRel.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!rel) return null;
  const base = path.basename(rel);
  const candidates = [
    path.join(naftaStartRoot(), "clinic", rel),
    path.join(labDumpDir(), base),
    path.join(naftaStartRoot(), "clinic", "files", "lab", base),
  ];
  for (const c of candidates) {
    if (isUsableLabFile(c)) return c;
  }
  const id = orderIdFromRel(rel);
  if (id) {
    const indexed = labDumpIndexById().get(id);
    if (indexed && isUsableLabFile(indexed)) return indexed;
  }
  return null;
}

export function assertLabSourceExists(fileRel: string): string {
  const src = resolveLabSourcePath(fileRel);
  if (!src) {
    throw new Error(`Lab file missing for ${fileRel}`);
  }
  return src;
}

export function tryCopyLabFileOnImport(
  fileRel: string,
  labOrderId: string,
): { storedPath: string; fileName: string } | null {
  const src = resolveLabSourcePath(fileRel);
  if (!src) return null;
  const fileName = path.basename(src);
  const destDir = path.join(clinicDataRoot(), "lab-import", labOrderId);
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, fileName);
  fs.copyFileSync(src, dest);
  return { storedPath: dest, fileName };
}

export function copyLabFileOnImport(fileRel: string, labOrderId: string): {
  storedPath: string;
  fileName: string;
} {
  const copied = tryCopyLabFileOnImport(fileRel, labOrderId);
  if (!copied) throw new Error(`Lab file missing for ${fileRel}`);
  return copied;
}

export function readStoredLabFile(storedPath: string): { body: Buffer; fileName: string } | null {
  if (!storedPath || !fs.existsSync(storedPath)) return null;
  return { body: fs.readFileSync(storedPath), fileName: path.basename(storedPath) };
}
