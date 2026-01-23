# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the React + Vite UI. Key areas: `src/components` for UI, `src/binding/model` for request/response types, `src/utility` for helpers, and `src/App.css` for global styles.
- `public/` holds static assets copied into the Vite build.
- `src-tauri/` is the Rust/Tauri backend. Core code lives in `src-tauri/src`, bindings in `src-tauri/src/binding/model`, config in `src-tauri/tauri.conf.json`, and icons in `src-tauri/icons`.
- `config/` contains local connection/token cache JSON files; avoid committing real credentials.

## Build, Test, and Development Commands
- `npm install` installs frontend dependencies.
- `npm run dev` starts the Vite dev server (Tauri expects `http://localhost:1420`).
- `npm run tauri dev` runs the desktop app in development mode.
- `npm run build` compiles the frontend into `dist/`.
- `npm run tauri build` packages the Tauri app for distribution.
- `npm run preview` serves the built frontend for smoke checks.

## Coding Style & Naming Conventions
- TypeScript/React uses 4-space indentation and double quotes in existing files. Keep `strict`, `noUnusedLocals`, and `noUnusedParameters` clean.
- Components are PascalCase and live in `src/components` (e.g., `ResultsWindow.tsx`). Helpers and modules use `camelCase` or `snake_case` as appropriate.
- Rust modules/files follow `snake_case`, types use `PascalCase`. Format Rust with `cargo fmt`.
- When editing request/response models, keep the TS and Rust bindings aligned.

## Testing Guidelines
- No automated test framework is configured yet. Validate changes with `npm run dev` and `npm run tauri dev`.
- If you add tests, place them next to the feature (`src/...` or `src-tauri/src/...`) and update scripts to run them.

## Commit & Pull Request Guidelines
- Commit subjects are short and imperative (e.g., `update`, `give objectives`). Keep messages concise and scoped.
- PRs should include a clear description, verification steps, and screenshots or recordings for UI changes.
- Link related issues or notes for any backend or configuration changes.
