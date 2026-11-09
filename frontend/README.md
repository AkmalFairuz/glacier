# Glacier frontend

The Glacier web app: Vite + React + TypeScript.

- **Data**: TanStack Query for REST, kept in sync by gateway events; zustand for client state
- **API client**: openapi-fetch, typed from the generated spec (`src/lib/api-schema.d.ts`)
- **Styling**: CSS Modules with design tokens in `src/styles/tokens.css` (light and dark themes)
- **Icons and font**: react-icons, Roboto

## Run

Start the backend first (see `../backend/README.md`), then:

```sh
npm install
npm run dev        # http://localhost:5173
```

The dev server proxies `/api` and `/gateway` to `localhost:3000`, and `/files` to MinIO on
`localhost:9000`. In Docker, the app is built into the nginx image (see `Dockerfile`).

## Scripts

| Script              | What it does                                        |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Dev server with hot reload                          |
| `npm run build`     | Typecheck and build to `dist/`                      |
| `npm run typecheck` | TypeScript only                                     |
| `npm run lint`      | ESLint                                              |
| `npm run format`    | Prettier (`format:check` to check only)             |
| `npm run gen:api`   | Regenerate API types from `../openapi/openapi.yaml` |

## Layout

```
src/app/        App shell, router, providers, gateway sync
src/ui/         Reusable primitives: Button, Dialog, Menu, Select, Avatar, Toggle, ...
src/features/   One folder per feature: auth, servers, channels, messages, dms, voice,
                members, roles, profile, settings, user, search, invites, reads, emoji
src/lib/        API client, gateway client, query keys, permissions, formatting
src/styles/     Tokens, reset and global styles
```
