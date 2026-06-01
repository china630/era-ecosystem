export function registryMeta(source: string, asOf: string) {
  return {
    asOf,
    source,
    version: "v1",
  };
}
