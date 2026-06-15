/** Serialize BigInt as string in JSON responses (ADR: minor units). */
export function installBigIntJsonSerializer(): void {
  const proto = BigInt.prototype as unknown as { toJSON?: () => string };
  if (!proto.toJSON) {
    proto.toJSON = function toJSON() {
      return this.toString();
    };
  }
}

export function minorToNumber(value: bigint): number {
  return Number(value);
}

export function assertMinor(value: bigint): bigint {
  if (value < 0n) throw new Error("Amount must be non-negative");
  return value;
}
