type HttpBag = {
  get: Function;
  post: Function;
  put: Function;
  patch: Function;
  delete: Function;
};

/** Call a generated Nest register() handler and read the Express-style JSON reply. */
export async function invokeNest(
  register: (http: HttpBag) => void,
  method: "get" | "post" | "put" | "patch" | "delete",
  path: string,
  init?: { headers?: Record<string, string>; body?: unknown; params?: Record<string, string> },
) {
  const handlers = new Map<string, Function>();
  const http = {} as HttpBag;
  for (const verb of ["get", "post", "put", "patch", "delete"] as const) {
    http[verb] = (route: string, fn: Function) => {
      handlers.set(`${verb} ${route}`, fn);
    };
  }
  register(http);
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
  };
  const req = {
    method: method.toUpperCase(),
    url: path,
    originalUrl: path,
    body: init?.body,
    params: init?.params ?? {},
    headers,
    get(name: string) {
      const key = name.toLowerCase();
      const found = Object.entries(headers).find(([k]) => k.toLowerCase() === key);
      return found?.[1];
    },
  };
  const handler = handlers.get(`${method} ${path}`);
  if (!handler) throw new Error(`no ${method} handler for ${path}`);
  await handler(req, res);
  return {
    status: statusCode,
    json: async () => payload,
  };
}
