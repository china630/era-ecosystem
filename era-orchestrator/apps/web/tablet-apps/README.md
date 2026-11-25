# Tablet app releases

Public URLs (Traefik → `era-tablet-apps` nginx, no login):

- `https://app.era-365.online/tablet-apps/nurse/version.json`
- `https://app.era-365.online/tablet-apps/guest/version.json`
- `https://app.era-365.online/tablet-apps/hotel-staff/version.json`

**Production files** live on the droplet under `/opt/era-ecosystem/data/tablet-apps/<slug>/`
(compose service `tablet-apps` mounts `./data/tablet-apps`).

Drop the APK in the matching folder and set `versionCode` higher than the build already on the tablets. `apkUrl` is the public URL of that file. One folder per app. Organization id is not part of the path.

`versionCode: 0` means no tablet updates until a real build is published.

The Next.js route under `apps/web/app/tablet-apps` is optional fallback (`TABLET_APPS_DIR`). Do not commit APK files.
