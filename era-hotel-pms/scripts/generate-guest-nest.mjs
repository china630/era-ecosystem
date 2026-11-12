import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const esbuild = require("esbuild");

const root = path.resolve(import.meta.dirname, "..");
const api = path.join(root, "app", "api");
const outDir = path.join(root, "nest", "generated");

function walk(dir) {
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) files.push(...walk(full));
    else if (name === "route.ts") files.push(full);
  }
  return files;
}

function braceBody(source, open) {
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error("unbalanced");
}

function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let start = 0;
  let quote = "";
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (quote) {
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "(" || ch === "{" || ch === "[") depth += 1;
    else if (ch === ")" || ch === "}" || ch === "]") depth -= 1;
    else if (ch === "," && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(body.slice(start));
  return parts;
}

function replaceResponseJson(body) {
  const token = "return Response.json(";
  let out = "";
  let i = 0;
  while (i < body.length) {
    const at = body.indexOf(token, i);
    if (at < 0) {
      out += body.slice(i);
      break;
    }
    out += body.slice(i, at);
    let j = at + token.length;
    let depth = 1;
    while (j < body.length && depth > 0) {
      if (body[j] === "(") depth += 1;
      else if (body[j] === ")") depth -= 1;
      j += 1;
    }
    const parts = splitTopLevel(body.slice(at + token.length, j - 1));
    out += sendJsonCall(parts);
    i = j;
  }
  return out;
}

function sendJsonCall(parts) {
  if (parts.length < 2) return `return sendJson(httpRes, ${parts[0]})`;
  const literal = (parts[1].match(/status:\s*(\d+)/) ?? [])[1];
  if (literal && !parts[1].includes("(")) return `return sendJson(httpRes, ${parts[0]}, ${literal})`;
  return `return sendJson(httpRes, ${parts[0]}, (${parts[1]}).status ?? 200)`;
}

function replaceNextResponse(body) {
  const token = "return NextResponse.json(";
  let out = "";
  let i = 0;
  while (i < body.length) {
    const at = body.indexOf(token, i);
    if (at < 0) {
      out += body.slice(i);
      break;
    }
    out += body.slice(i, at);
    let j = at + token.length;
    let depth = 1;
    while (j < body.length && depth > 0) {
      if (body[j] === "(") depth += 1;
      else if (body[j] === ")") depth -= 1;
      j += 1;
    }
    const parts = splitTopLevel(body.slice(at + token.length, j - 1));
    out += sendJsonCall(parts);
    i = j;
  }
  return out;
}

function replaceJsonError(body) {
  const token = "return jsonError(";
  let out = "";
  let i = 0;
  while (i < body.length) {
    const at = body.indexOf(token, i);
    if (at < 0) {
      out += body.slice(i);
      break;
    }
    out += body.slice(i, at);
    let j = at + token.length;
    let depth = 1;
    while (j < body.length && depth > 0) {
      if (body[j] === "(") depth += 1;
      else if (body[j] === ")") depth -= 1;
      j += 1;
    }
    const parts = splitTopLevel(body.slice(at + token.length, j - 1));
    const status = parts[1] ? parts[1].trim() : "400";
    out += `return sendJson(httpRes, { error: ${parts[0]} }, ${status})`;
    i = j;
  }
  return out;
}

function replaceJsonOk(body) {
  const token = "return jsonOk(";
  let out = "";
  let i = 0;
  while (i < body.length) {
    const at = body.indexOf(token, i);
    if (at < 0) {
      out += body.slice(i);
      break;
    }
    out += body.slice(i, at);
    let j = at + token.length;
    let depth = 1;
    while (j < body.length && depth > 0) {
      if (body[j] === "(") depth += 1;
      else if (body[j] === ")") depth -= 1;
      j += 1;
    }
    const inner = body.slice(at + token.length, j - 1);
    out += `return sendJson(httpRes, ${inner})`;
    i = j;
  }
  return out;
}

function routePath(file) {
  const rel = path.relative(path.join(root, "app", "api"), path.dirname(file));
  return (
    "/api/" +
    rel
      .split(path.sep)
      .map((part) => (part.startsWith("[") ? `:${part.slice(1, -1)}` : part))
      .join("/")
  );
}

function handlers(source) {
  const found = [];
  const re = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g;
  for (const match of source.matchAll(re)) {
    const paren = source.indexOf("(", match.index);
    let depth = 0;
    let cursor = paren;
    for (; cursor < source.length; cursor += 1) {
      if (source[cursor] === "(") depth += 1;
      else if (source[cursor] === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const sig = source.slice(paren, cursor + 1);
    const named = sig.match(/\b(request|req)\b/);
    const open = source.indexOf("{", cursor);
    let depthSpan = 0;
    let close = open;
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === "{") depthSpan += 1;
      else if (source[i] === "}") {
        depthSpan -= 1;
        if (depthSpan === 0) {
          close = i;
          break;
        }
      }
    }
    let raw = source.slice(open + 1, close);
    const tryAt = raw.indexOf("try {");
    if (tryAt >= 0) {
      const tryOpen = tryAt + 4;
      let depth = 0;
      let end = -1;
      for (let i = tryOpen; i < raw.length; i += 1) {
        if (raw[i] === "{") depth += 1;
        else if (raw[i] === "}") {
          depth -= 1;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      const after = end >= 0 ? raw.slice(end + 1) : "";
      if (end >= 0 && /^\s*catch\s*\([^)]*\)\s*\{\s*return handleRouteError\(/.test(after)) {
        raw = raw.slice(0, tryAt) + raw.slice(tryOpen + 1, end);
      }
    }
    found.push({
      method: match[1].toLowerCase(),
      body: raw,
      input: named ? named[1] : "request",
      start: match.index,
      end: close + 1,
    });
  }
  return found;
}

function headParts(source, found) {
  let head = source;
  const called = new Set(
    ["GET", "POST", "PUT", "PATCH", "DELETE"].filter((name) =>
      found.some((handler) => new RegExp(`\\b${name}\\s*\\(`).test(handler.body)),
    ),
  );
  for (const handler of [...found].reverse()) {
    if (called.has(handler.method.toUpperCase())) continue;
    head = head.slice(0, handler.start) + head.slice(handler.end);
  }
  const imports = [];
  const drop = new Set();
  if (!head.includes("jsonError(")) drop.add("jsonError");
  if (!head.includes("handleRouteError(")) drop.add("handleRouteError");
  const stillJsonOk = found.some((handler) => transform(handler.body).includes("jsonOk(")) || head.includes("jsonOk(");
  if (!stillJsonOk) drop.add("jsonOk");
  const withoutImports = head.replace(/import[\s\S]*?from\s+['"][^'"]+['"];/g, "");
  if (!withoutImports.includes("getSatelliteSession")) drop.add("getSatelliteSession");
  head = head.replace(/import[\s\S]*?from\s+['"][^'"]+['"];/g, (block) => {
    const parsed = block.match(/import\s+([\s\S]*?)\s+from\s+(['"][^'"]+['"])\s*;/);
    if (!parsed) return "";
    const spec = parsed[1].trim();
    if (!spec.startsWith("{")) {
      imports.push(block.trim());
      return "";
    }
    const kept = spec
      .slice(1, -1)
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name && !drop.has(name.split(/\s+as\s+/)[0].trim()));
    if (!kept.length) return "";
    imports.push(`import { ${kept.join(", ")} } from ${parsed[2]};`);
    return "";
  });
  return { imports: imports.join("\n"), prelude: head.trim() };
}

function transform(body) {
  let next = body
    .replace(/await getSatelliteSession\(\)/g, "session")
    .replace(/\b_request\b/g, "request")
    .replace(/\b_req\b/g, "request")
    .replace(/await\s+[A-Za-z0-9_.]*params\b/g, "httpReq.params")
    .split("\n")
    .filter((line) => !/const session = (await )?session\b/.test(line))
    .join("\n");
  next = next.replace(/new URL\(\s*(?!request\b|req\b)[A-Za-z_][A-Za-z0-9_]*\.url\s*\)/g, 'new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1")');
  next = next.replace(/await\s+[A-Za-z_][A-Za-z0-9_]*\.json\(\)/g, "httpReq.body");
  next = next.replace(/httpReq\.body\.catch\(\(\) => \(\{\}\)\)/g, "(httpReq.body ?? {})");
  next = next.replace(/await\s+[A-Za-z_][A-Za-z0-9_]*\.formData\(\)/g, "await readNestForm(httpReq)");
  next = next.replace(
    /return new NextResponse\(\s*new Uint8Array\(([^)]+)\)\s*,\s*\{\s*headers:\s*(\{[\s\S]*?\})\s*,?\s*\}\s*\)/g,
    "return sendBytes(httpRes, Buffer.from($1), $2)",
  );
  next = next.replace(/return handleRouteError\(([^)]+)\)/g, "return sendRouteError(httpRes, $1)");
  next = next.replace(
    /return jsonLoginHostBinding\(([^)]*)\);/g,
    "return sendWebResponse(httpRes, jsonLoginHostBinding($1));",
  );
  next = next.replace(/\breturn res;/g, "return sendWebResponse(httpRes, res);");
  next = replaceNextResponse(next);
  next = replaceResponseJson(next);
  next = replaceJsonError(next);
  next = replaceJsonOk(next);
  return next;
}

fs.mkdirSync(outDir, { recursive: true });
const skip = (file) => {
  const rel = file.split(path.sep).join("/");
  if (rel.includes("/internal/v1/organization/bind/")) return true;
  if (rel.includes("/internal/v1/runtime-config/")) return true;
  if (rel.includes("/platform/billing-status/")) return true;
  return false;
};
const files = walk(api)
  .filter((file) => !skip(file))
  .sort((a, b) => {
    const pa = routePath(a).includes(":") ? 1 : 0;
    const pb = routePath(b).includes(":") ? 1 : 0;
    if (pa !== pb) return pa - pb;
    return routePath(a).localeCompare(routePath(b));
  });
const modules = [];
const extraPaths = new Map();

for (const file of files) {
  let source = "";
  try {
    source = fs.readFileSync(file, "utf8");
    if (!source.includes("export async function")) {
      const reexport = source.match(/export\s*\{\s*GET\s*\}\s*from\s*['"]\.\/layout\/route['"]/);
      if (reexport) {
        extraPaths.set(path.join(path.dirname(file), "layout", "route.ts"), routePath(file));
        console.log("alias", routePath(file), "-> layout");
        continue;
      }
      console.log("skip no handler", routePath(file));
      continue;
    }
    if (source.includes("formData(")) {
      console.log("multipart", routePath(file));
    }
    const found = handlers(source);
    if (!found.length) {
      console.log("skip empty", routePath(file));
      continue;
    }
    const slug = routePath(file)
      .replace("/api/", "")
      .replace(/[:/]/g, "_");
    const fns = found
      .map((handler) => {
        const body = transform(handler.body);
        const input = handler.input;
        const shim = `      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const ${input} = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };`;
        const staff = handler.body.includes("getSatelliteSession");
        const paths = [routePath(file)];
        const extra = extraPaths.get(file);
        if (extra && handler.method === "get") paths.push(extra);
        const registrations = paths
          .map((pathname) => {
        const agency = routePath(file).startsWith("/api/agency");
        const agencyGate = agency ? "    if (rejectMissingAgency(httpReq, httpRes)) return;\n" : "";
        if (!staff) {
          return `  http.${handler.method}(${JSON.stringify(pathname)}, async (httpReq, httpRes) => {
    try {
${agencyGate}      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
${shim}
${body}
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });`;
        }
        return `  http.${handler.method}(${JSON.stringify(pathname)}, async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
${shim}
${body}
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });`;
          })
          .join("\n");
        return registrations;
      })
      .join("\n");
    const head = headParts(source, found);
    const text = `${head.imports}
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

${head.prelude}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
${fns}
}
`;
    if (!esbuild.transformSync(text, { loader: "ts" })) {
      console.log("skip syntax", routePath(file));
      continue;
    }
    const out = path.join(outDir, `${slug}.ts`);
    fs.writeFileSync(out, text);
    modules.push(`./${slug}`);
    console.log(routePath(file), found.map((h) => h.method).join(","));
  } catch (err) {
    console.log("skip error", routePath(file), err.message);
  }
}

const index = modules
  .map((mod, i) => `import { register as register${i} } from ${JSON.stringify(mod)};`)
  .join("\n");
const calls = modules.map((_, i) => `  register${i}(http);`).join("\n");
fs.writeFileSync(
  path.join(outDir, "register.ts"),
  `${index}\n\nexport function registerGuestRoutes(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {\n${calls}\n}\n`,
);
console.log("routes", files.length);
