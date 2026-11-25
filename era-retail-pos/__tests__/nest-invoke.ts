/** Call a Nest controller method and read the Express-style JSON reply. */
export async function invokeMethod(
  method: (req: unknown, res: unknown) => Promise<unknown>,
  init?: { headers?: Record<string, string>; body?: unknown; params?: Record<string, string> },
) {
  const headers = init?.headers ?? {};
  let statusCode = 200;
  let payload: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: unknown) {
      payload = data;
      return this;
    },
    send(data: unknown) {
      payload = data;
      return this;
    },
    setHeader() {
      return this;
    },
    cookie() {
      return this;
    },
  };
  const req = {
    method: "POST",
    url: "/",
    originalUrl: "/",
    body: init?.body,
    params: init?.params ?? {},
    headers,
    get(name: string) {
      const key = name.toLowerCase();
      const found = Object.entries(headers).find(([k]) => k.toLowerCase() === key);
      return found?.[1];
    },
  };
  await method(req, res);
  return {
    status: statusCode,
    json: async () => payload,
  };
}
