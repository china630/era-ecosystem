#!/usr/bin/env bash
# Create a persistent 4 GiB /swapfile when none is active (Nafta 8 GB droplet).
# Idempotent. Requires root.
set -euo pipefail

if swapon --show | grep -q .; then
  echo "==> swap already active:"
  swapon --show
  free -h
  exit 0
fi

if [ -f /swapfile ]; then
  echo "==> /swapfile exists but not active — enabling"
else
  echo "==> creating 4 GiB /swapfile"
  if command -v fallocate >/dev/null 2>&1; then
    fallocate -l 4G /swapfile
  else
    dd if=/dev/zero of=/swapfile bs=1M count=4096 status=progress
  fi
fi

chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

if ! grep -qE '^[[:space:]]*/swapfile[[:space:]]' /etc/fstab; then
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "==> added /swapfile to /etc/fstab"
fi

# Prefer keeping apps in RAM; swap is a cushion, not a second heap.
sysctl -w vm.swappiness=10 >/dev/null
if ! grep -q '^vm.swappiness=' /etc/sysctl.conf 2>/dev/null; then
  echo 'vm.swappiness=10' >> /etc/sysctl.conf
fi

echo "==> swap ready"
swapon --show
free -h
