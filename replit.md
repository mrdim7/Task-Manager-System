# TaskFlow

A full-stack task management system with JWT auth, security-group-based visibility, parent/child tasks, notes, and an admin portal.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000 → proxied at `/api`)
- `pnpm --filter @workspace/web run dev` — run the React web app (proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — JWT signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (at `/api`)
- DB: PostgreSQL + Drizzle ORM
- Auth: JWT via `jsonwebtoken` + `bcryptjs`; token stored in `localStorage("auth_token")`
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Frontend: React + Vite, shadcn/ui, TanStack Query, wouter routing
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for types)
- `lib/api-client-react/src/generated/` — auto-generated React Query hooks + Zod schemas
- `lib/db/src/schema/` — Drizzle table definitions (users, security-groups, categories, priorities, tasks)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/auth.ts` — JWT sign/verify helpers
- `artifacts/api-server/src/middlewares/authenticate.ts` — JWT middleware + requireAdmin
- `artifacts/web/src/pages/` — React pages (dashboard, tasks, task-detail, users, security-groups, settings, login)
- `artifacts/web/src/contexts/auth-context.tsx` — auth state (user, login, logout)

## Architecture decisions

- JWT-based auth (no sessions) — suitable for on-prem Ubuntu hosting without Redis
- OpenAPI-first contract: all types generated from `openapi.yaml` via Orval; never hand-write API types
- Task progress on parent tasks is computed from children's average progress in the backend `buildTaskResponse` helper
- Security groups control task visibility — root tasks are tagged with groups; subtasks inherit parent visibility
- `bcryptjs` used instead of `bcrypt` (pure JS, no native bindings needed)

## Product

- Email/password login with JWT
- Dashboard: task counts, my tasks, overdue tasks
- Task list with tree view (parent/child), category/priority filters, inline progress
- Task detail: edit all fields, manage subtasks, add/delete notes, set security groups
- Admin portal: user management (create/edit/delete/reset password), security group management, categories & priorities settings

## Default credentials (seeded)

- `admin@taskflow.com` / `admin123` — admin user
- `bob@taskflow.com` / `user123` — regular user
- `carol@taskflow.com` / `user123` — regular user

## User preferences

- On-prem hosting target (Ubuntu), so JWT not sessions; no OAuth
- Admin-only routes: user management, security groups, categories, priorities

## Gotchas

- Always run `pnpm run typecheck:libs` before `pnpm --filter @workspace/api-server run typecheck` if DB schema changed
- Express 5 types `req.params.*` as `string | string[]` — always cast with `String(req.params.id)`
- Drizzle `date` columns use string format (`YYYY-MM-DD`), not JS `Date` — cast with `String(value)` before inserting
- `useGetMe` hook takes a single `options` object with a `query` key (not a separate params arg)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
