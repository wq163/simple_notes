# Repository Guidelines

## Project Structure & Module Organization

The application is split between `src/client/` (Vue 3, Pinia, Vue Router, and shared CSS) and `src/server/` (Express routes, authentication middleware, configuration, and SQLite access). Frontend views live in `src/client/views/`; reusable UI belongs in `src/client/components/`. Keep API endpoints in `src/server/routes/` and shared server helpers in `src/server/utils/`. Runtime defaults are stored in `config/default.json`. Production output is generated under `dist/`. The native Android wrapper is a separate Gradle project in `android-app/`. Release notes belong in `changelog/`.

## Build, Test, and Development Commands

- `npm ci`: install the exact dependency versions from `package-lock.json`.
- `npm run dev`: start the Vite client and watched Express server together.
- `npm run dev:client` / `npm run dev:server`: run one development process independently.
- `npm run build`: build the client into `dist/client/` and compile the server into `dist/server/`.
- `npm start`: run the compiled production server.
- `bash package.sh`: build and create a timestamped deployment archive in `dist/`.
- `cd android-app && ./gradlew assembleDebug`: build the Android debug APK.

## Coding Style & Naming Conventions

Use TypeScript with strict type checking and follow the existing two-space indentation, single quotes, and semicolon style. Name Vue components and views in PascalCase (`NoteEditorView.vue`), composable stores as `useXStore`, and server route modules with lowercase domain names (`notes.ts`). Prefer the configured `@/` alias for client imports. No formatter or linter is currently configured, so keep edits consistent with nearby code and avoid unrelated reformatting.

## Testing Guidelines

There is no formal automated test suite or coverage requirement yet; root-level experimental scripts are not a substitute for regression tests. Before submitting changes, run `npm run build` for TypeScript and bundling validation, then manually exercise the affected UI or API path. Do not commit generated `dist/`, database, upload, or APK artifacts unless a release explicitly requires them.

## Commit & Pull Request Guidelines

Recent history uses short, imperative summaries such as `fix scroll bug in apk` or concise feature descriptions. Keep each commit focused and explain the affected area. Pull requests should include a clear problem/solution summary, validation performed, linked issues when applicable, and screenshots for visible UI changes. Call out configuration, data-migration, or deployment implications explicitly.

## Security & Configuration

Never commit production JWT secrets, credentials, SQLite data, or user attachments. Override `PORT`, `DATA_DIR`, and `JWT_SECRET` through the environment, and change the documented default administrator password immediately after deployment.
