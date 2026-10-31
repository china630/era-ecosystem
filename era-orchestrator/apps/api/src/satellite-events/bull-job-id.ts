/** BullMQ custom ids cannot contain ":". */
export function bullJobId(raw: string): string {
  return raw.replaceAll(":", "-");
}
