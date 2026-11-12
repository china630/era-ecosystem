/**
 * One local origin for the clinic.
 * Pages, Next assets, and HMR go to Next. /api goes straight to Nest.
 * Browser stays on CLINIC_FRONT_PORT (3222 while Docker holds 3203).
 * Nest listens on 13203. Next listens on 23203. The container publishes 3203.
 */
import http from "node:http";

const nestOrigin = process.env.CLINIC_NEST_URL ?? "http://127.0.0.1:13203";
const nextOrigin = process.env.CLINIC_NEXT_URL ?? "http://127.0.0.1:23203";
const port = Number(process.env.CLINIC_FRONT_PORT ?? 3222);

function originFor(urlPath) {
  const path = urlPath.split("?")[0];
  if (path === "/api" || path.startsWith("/api/")) return nestOrigin;
  return nextOrigin;
}

function firstHeader(value) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function publicOrigin(req) {
  const host = firstHeader(req.headers["x-forwarded-host"]) || firstHeader(req.headers.host);
  const proto = (firstHeader(req.headers["x-forwarded-proto"]) || "http").split(",")[0].trim();
  const name = host.split(",")[0].trim();
  if (!name) return null;
  return `${proto}://${name}`;
}

function rewriteInternalLocation(headers, req, upstreamOrigin) {
  const current = firstHeader(headers.location);
  if (!current || current.startsWith("/")) return;
  const pub = publicOrigin(req);
  if (!pub) return;
  try {
    const url = new URL(current);
    const internal = new URL(upstreamOrigin);
    const localName = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
    const sameListen = url.host === internal.host || (localName && url.port === internal.port);
    if (!sameListen) return;
    headers.location = `${pub}${url.pathname}${url.search}${url.hash}`;
  } catch {
    /* leave a non-URL Location alone */
  }
}

function proxy(req, res) {
  const base = originFor(req.url ?? "/");
  const target = new URL(req.url ?? "/", base);
  const headers = { ...req.headers };
  const upstream = http.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      path: `${target.pathname}${target.search}`,
      method: req.method,
      headers,
    },
    (up) => {
      const out = { ...up.headers };
      rewriteInternalLocation(out, req, base);
      res.writeHead(up.statusCode ?? 502, out);
      up.pipe(res);
    },
  );
  upstream.on("error", (err) => {
    if (res.headersSent) return;
    res.writeHead(502, { "content-type": "text/plain" });
    res.end(err.message);
  });
  req.pipe(upstream);
}

const server = http.createServer(proxy);
server.requestTimeout = 0;
server.headersTimeout = 0;
server.on("upgrade", (req, socket, head) => {
  const target = new URL(req.url ?? "/", nextOrigin);
  const upstream = http.request({
    hostname: target.hostname,
    port: target.port,
    path: `${target.pathname}${target.search}`,
    method: "GET",
    headers: req.headers,
  });
  upstream.on("upgrade", (upRes, upSocket, upHead) => {
    const lines = [`HTTP/1.1 ${upRes.statusCode} ${upRes.statusMessage}`];
    for (const [key, value] of Object.entries(upRes.headers)) {
      if (value == null) continue;
      const list = Array.isArray(value) ? value : [value];
      for (const item of list) lines.push(`${key}: ${item}`);
    }
    socket.write(`${lines.join("\r\n")}\r\n\r\n`);
    if (upHead.length) socket.write(upHead);
    if (head.length) upSocket.write(head);
    upSocket.pipe(socket);
    socket.pipe(upSocket);
  });
  upstream.on("error", () => socket.destroy());
  upstream.end();
});

server.listen(port, "127.0.0.1", () => {
  console.log(`clinic front http://127.0.0.1:${port}  api ${nestOrigin}  pages ${nextOrigin}`);
});
