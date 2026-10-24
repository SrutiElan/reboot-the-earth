# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

- `frontend/`: Next.js App Router app (OFO data catalog under `app/data/`, catalog components in `components/catalog/`, data helpers in `lib/catalog/`).
- `backend/`: FastAPI + PostGIS service (catalog API, read-only SQL console, LLM assistant). Its README covers setup.
- `docker-compose.yml`: PostGIS, the OFO importer, the backend and the frontend. `docker compose up --build` runs everything; the API is on port 8000.

Run the frontend commands below from `frontend/`.

## Commands

```bash
npm install       # install dependencies (npm; package-lock.json is committed)
npm run dev       # dev server at http://localhost:3000
npm run build     # production build (also type-checks)
npm run start     # serve the production build
npm run lint      # ESLint (flat config: next core-web-vitals + typescript)
npx tsc --noEmit  # type-check only
```

No frontend test framework is set up yet. Backend tests live in `backend/tests/`.

## Next.js version: read the bundled docs first

This project uses **Next.js 16.4 / React 19.3**, which has breaking changes from older Next.js versions (APIs, conventions, file structure). Before writing Next.js code, read the relevant guide in `frontend/node_modules/next/dist/docs/` (`01-app/` covers the App Router) and follow any deprecation notices. `frontend/AGENTS.md` says the same thing. `next dev` regenerates that file, so leave its contents alone.

`next.config.ts` turns on features that change how the app behaves, so check the docs before working around them:
- `cacheComponents: true` makes caching and dynamic rendering opt-in (`"use cache"`, `<Suspense>` boundaries), which changes how data fetching and dynamic APIs behave.
- `partialPrefetching: true`
- `experimental.agentFeedback: true`
- Turbopack runs CSS through `@tailwindcss/turbopack` (Tailwind v4). You don't need a `tailwind.config` or PostCSS config. Theme tokens live in `app/globals.css` through `@theme inline`, with dark mode handled by `prefers-color-scheme`.

## Conventions

- Use the `@/*` import alias for paths from `frontend/`.
- Type layouts and pages with the global route helper types (for example `LayoutProps<"/">` in `app/layout.tsx`). Next generates these types in `.next/types`.
- TypeScript runs in `strict` mode.
