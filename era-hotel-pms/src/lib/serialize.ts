import { Prisma } from '@prisma/client';

export function serialize<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_key, value) => {
      if (value instanceof Prisma.Decimal) {
        return value.toNumber();
      }
      return value;
    }),
  );
}
