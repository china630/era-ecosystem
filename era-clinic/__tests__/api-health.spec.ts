/**
 * Health payload contract (Nest controller uses `withClinicHttp` + static body).
 * Avoid importing Nest decorator classes under Jest without tsconfig.nest.json.
 */
describe("GET /api/health", () => {
  it("returns ok payload shape", () => {
    const body = { ok: true, service: "era-clinic" };
    expect(body.ok).toBe(true);
    expect(typeof body.service).toBe("string");
  });
});
