/**
 * One local origin. /api goes to Nest. Pages go to Next.
 * Nest 13206. Next 23206. Public port 3206 is the container port.
 * Local front uses CONSTRUCTION_FRONT_PORT (default 3206). If Docker holds 3206, set another port.
 */
import http from "node:http";

const nestOrigin = process.env.CONSTRUCTION_NEST_URL ?? "http://127.0.0.1:13206";
const nextOrigin = process.env.CONSTRUCTION_NEXT_URL ?? "http://127.0.0.1:23206";
const port = Number(process.env.CONSTRUCTION_FRONT_PORT ?? 3206);

function originFor(urlPath) {
  const path = urlPath.split("?")[0];
  if (path === "/api" || path.startsWith("/api/")) return nestOrigin;
  return nextOrigin;
}

function proxy(req, res) {
  const base = originFor(req.url ?? "/");
  const target = new URL(req.url ?? "/", base);
  const headers = { ...req.headers, host: target.host };
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
      res.writeHead(up.statusCode ?? 502, up.headers);
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
    if (head.length) socket.write(head);
    upSocket.pipe(socket);
    socket.pipe(upSocket);
  });
  upstream.on("error", () => socket.destroy());
  upstream.end();
});

server.listen(port, "127.0.0.1", () => {
  console.log(`construction front http://127.0.0.1:${port}  api ${nestOrigin}  pages ${nextOrigin}`);
});
