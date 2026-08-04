# Digit RMS Desktop App

The desktop app uses Electron and packages the same React/Vite interface used by the web app.
It can connect to:

- the hosted production backend on `https://rms.digitnp.com/api` by default
- a local or alternate backend by setting `DIGIT_DESKTOP_API_BASE_URL`

The packaged desktop app does not start its bundled backend when using the hosted API, so no PostgreSQL installation is required on the POS computer. Local development mode can still start the bundled Node/Express backend and requires PostgreSQL.

## Local Desktop Setup

From the project root:

```bash
npm install
npm run desktop:db
npm run desktop:migrate
npm run desktop:seed
npm run dev:desktop
```

Default local database:

```text
postgresql://postgres:postgres@127.0.0.1:5432/restaurant_pos
```

Default desktop API:

```text
https://rms.digitnp.com/api
```

## Run Packaged-Style Desktop App Locally

```bash
npm run desktop:db
npm run desktop:migrate
npm run desktop
```

`npm run desktop` builds the desktop UI and opens Electron. If the API is not healthy, the app shows a desktop status screen with retry and backend restart actions.

## Package The Desktop App

Package for the current operating system:

```bash
npm run package:desktop
```

Package for macOS:

```bash
npm run package:mac
```

Package for Windows:

```bash
npm run package:windows
```

Output files are written to `release/`.

For Windows distribution through GitHub Releases, build on Windows:

```powershell
npm ci
npm run verify
npm run package:windows
```

Upload the generated `release/*Setup.exe` and, if needed, `release/*Portable.exe` files to the GitHub Release. Use the setup installer for real vendors and the portable build for demos or support.

For a signed production installer:

```powershell
$env:CSC_LINK='C:\secure\digit-pos-signing.pfx'
$env:CSC_KEY_PASSWORD='use-a-secret-store'
npm run release:windows
```

Never commit the signing certificate or password.

## Hosted Backend Mode

The installed app uses the hosted Digit RMS API by default. To use another hosted backend:

```bash
DIGIT_DESKTOP_API_BASE_URL="https://your-backend.example.com/api" npm run desktop
```

For an installed build, edit `desktop-config.json` in the app-data directory and set:

```json
{
  "apiBaseUrl": "https://your-backend.example.com/api"
}
```

The desktop app rejects non-local plain HTTP endpoints in packaged mode.

## Local Data

The desktop app stores local runtime config and uploads in the OS app-data folder. Use the "Open App Data Folder" button on the desktop status screen to inspect it.

The app generates a local JWT secret automatically for desktop mode if `JWT_SECRET` is not provided.

## Notes

- The hosted API must be reachable before login will work.
- PostgreSQL is only required on the POS computer in local mode.
- For local mode, set `DIGIT_DESKTOP_API_BASE_URL=http://127.0.0.1:5500/api` and run `npm run desktop:db` before opening the app.
- For first-time setup, run migrations and seed once.
- The bundled backend does not package secrets from `server/.env`.
- Image uploads are written to the desktop app-data folder using `UPLOAD_DIR`.
