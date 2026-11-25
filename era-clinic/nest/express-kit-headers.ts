/** Express request headers for kit handlers. Local so Nest does not depend on a kit barrel export the image may not have rebuilt. */
type ExpressLike = {
  get?: (name: string) => string | undefined;
  headers?: Record<string, unknown>;
};

function headerValue(bag: Record<string, unknown>, name: string): string | null {
  const value = bag[name.toLowerCase()] ?? bag[name];
  if (Array.isArray(value)) return value[0] == null ? null : String(value[0]);
  return value == null ? null : String(value);
}

export function expressKitHeaders(req: ExpressLike): { get(name: string): string | null } {
  return {
    get(name: string) {
      const direct = req.get?.(name);
      if (direct) return direct;
      return headerValue(req.headers ?? {}, name);
    },
  };
}
