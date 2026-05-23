#!/bin/sh
set -e
cd /app
if [ -f prisma/schema.prisma ]; then
  npx prisma generate 2>/dev/null || true
  npx prisma migrate deploy 2>/dev/null || npx prisma db push 2>/dev/null || true
fi
exec "$@"
