import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Module } from "@nestjs/common";
import { NestFactory, type NestApplication } from "@nestjs/core";
import { authCookieName, signSatelliteSession } from "../auth/session";
import {
  createSatelliteApiController,
  SatelliteMutationAuditInterceptor,
  type SatelliteMutationAuditRow,
} from "./satellite-mutation-audit";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("satellite mutation audit interceptor", () => {
  let app: NestApplication;
  let base: string;
  const rows: SatelliteMutationAuditRow[] = [];

  before(async () => {
    process.env.AUTH_JWT_SECRET = "test-secret-at-least-16-chars";
    const router = (
      req: { method?: string; url?: string },
      res: { status: (code: number) => { json: (body: unknown) => void } },
    ) => {
      const url = (req.url ?? "").split("?")[0];
      if (req.method === "POST" && url === "/api/notes") {
        res.status(200).json({ ok: true });
        return;
      }
      if (req.method === "POST" && url === "/api/notes/fail") {
        res.status(500).json({ error: "no" });
        return;
      }
      if (req.method === "GET" && url === "/api/notes") {
        res.status(200).json({ ok: true });
        return;
      }
      if (req.method === "POST" && url === "/api/auth/login") {
        res.status(200).json({ ok: true });
        return;
      }
      res.status(404).json({ error: "missing" });
    };
    const Controller = createSatelliteApiController(
      router as unknown as Parameters<typeof createSatelliteApiController>[0],
    );
    @Module({ controllers: [Controller] })
    class Mod {}
    app = await NestFactory.create(Mod, { logger: false });
    app.useGlobalInterceptors(
      new SatelliteMutationAuditInterceptor(async (row) => {
        rows.push(row);
        if (row.entityId === "boom") throw new Error("audit down");
      }),
    );
    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === "object" && address ? address.port : 0;
    base = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await app.close();
  });

  it("writes one row for a successful mutation and skips GET and exempt login", async () => {
    const token = await signSatelliteSession({
      sub: "user-1",
      login: "reception",
      role: "RECEPTION",
      fullName: "Reception",
      organizationId: ORG,
    });
    rows.length = 0;
    const post = await fetch(`${base}/api/notes`, {
      method: "POST",
      headers: { cookie: `${authCookieName()}=${token}` },
    });
    assert.equal(post.status, 200);
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.organizationId, ORG);
    assert.equal(rows[0]?.action, "POST");
    assert.equal(rows[0]?.entityId, "notes");

    const get = await fetch(`${base}/api/notes`);
    assert.equal(get.status, 200);
    const login = await fetch(`${base}/api/auth/login`, { method: "POST" });
    assert.equal(login.status, 200);
    const failed = await fetch(`${base}/api/notes/fail`, {
      method: "POST",
      headers: { cookie: `${authCookieName()}=${token}` },
    });
    assert.equal(failed.status, 500);
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(rows.length, 1);
  });
});
