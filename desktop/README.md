# Digit RMS Desktop App

The desktop app uses Electron and packages the same React/Vite interface used by the web app.
It can connect to:

- a local backend on `http://127.0.0.1:5500/api`
- a hosted backend by setting `DIGIT_DESKTOP_API_BASE_URL`

The packaged desktop app can start the bundled Node/Express backend automatically. PostgreSQL is still required because the system database is PostgreSQL.

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
http://127.0.0.1:5500/api
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

## Hosted Backend Mode

Use this when the desktop app should connect to a Render/VPS backend instead of local PostgreSQL:

```bash
DIGIT_DESKTOP_API_BASE_URL="https://your-backend.example.com/api" npm run desktop
```

For packaged builds, set the same variable before packaging:

```bash
DIGIT_DESKTOP_API_BASE_URL="https://your-backend.example.com/api" npm run package:desktop
```

## Local Data

The desktop app stores local runtime config and uploads in the OS app-data folder. Use the "Open App Data Folder" button on the desktop status screen to inspect it.

The app generates a local JWT secret automatically for desktop mode if `JWT_SECRET` is not provided.

## Notes

- PostgreSQL must be available before login will work.
- For local mode, run `npm run desktop:db` before opening the app.
- For first-time setup, run migrations and seed once.
- The bundled backend does not package secrets from `server/.env`.
- Image uploads are written to the desktop app-data folder using `UPLOAD_DIR`.
