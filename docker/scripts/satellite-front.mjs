/**
 * One public port for a satellite container.
 * /api goes to Nest (10000 + public port). Pages go to Next (20000 + public port).
 * Both upstreams stay on 127.0.0.1. The published port is PORT (3201, 3203, …).
 */
import http from "node:http";

const publicPort = Number(process.env.PORT ?? 3200);
const nestPort = Number(process.env.NEST_PORT ?? 10000 + publicPort);
const nextPort = Number(process.env.NEXT_PORT ?? 20000 + publicPort);
const nestOrigin = process.env.NEST_URL ?? `http://127.0.0.1:${nestPort}`;
const nextOrigin = process.env.NEXT_URL ?? `http://127.0.0.1:${nextPort}`;

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
    if (head.length) upSocket.write(head);
    upSocket.pipe(socket);
    socket.pipe(upSocket);
  });
  upstream.on("error", () => socket.destroy());
  upstream.end();
});

server.listen(publicPort, "0.0.0.0", () => {
  console.log(`satellite front :${publicPort}  api ${nestOrigin}  pages ${nextOrigin}`);
});
