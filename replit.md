# Zbarber

Plateforme multi-artifacts pour la réservation de salons de coiffure en RDC — app mobile publique (Expo), vitrine web, dashboard admin, et API REST.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `SESSION_SECRET`, `EXPO_PUBLIC_DOMAIN`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`

### Mobile store builds (EAS)

- `eas.json` defines build profiles. Each bakes the target API host via `EXPO_PUBLIC_DOMAIN` + matching Clerk proxy URL (`https://<host>/api/__clerk`):
  - `production` → `api.zbarber.net` (App Store / Play Store production)
  - `test` → `api.test.zbarber.net` (store internal-testing / TestFlight tracks)
  - `preview` → `api.test.zbarber.net` (internal distribution: APK / simulator)
  - `development` → `api.test.zbarber.net` (dev client)
- App identity: `net.zbarber.app` (iOS `bundleIdentifier` + Android `package`). Single identity — `test` builds ship to testing tracks of the same store app, not a separate listing.
- ⚠️ The `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` values in `eas.json` are placeholders (`pk_live_REPLACE_...`) — replace with the real Clerk **production** publishable keys before any real build (the Clerk proxy is prod-only). EAS builds: `pnpm --filter @workspace/mobile run eas:build:{preview,test,prod}`; submit: `eas:submit:{test,prod}`.
- Replit dev (`pnpm run dev`) and the Replit static deploy (`scripts/build.js`) are unaffected by `eas.json` — they derive the domain from `REPLIT_*` env at runtime.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Auth: Clerk (mobile via `@clerk/expo`, admin via `@clerk/react`, API via `@clerk/express` proxy)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Mobile: Expo Router v3, React Native, TanStack Query

## Where things live

- `lib/db/src/schema.ts` — source of truth for DB schema
- `lib/api-spec/openapi.yaml` — source of truth for API contract
- `lib/api-client-react/` — generated React Query hooks (do not edit)
- `lib/api-zod/` — generated Zod schemas (do not edit)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/clerkAuth.ts` — Clerk middleware + requireAuth/requireAdmin/requireApprovedBarber guards
- `artifacts/mobile/app/` — Expo Router file-based routes
- `artifacts/mobile/contexts/AppContext.tsx` — global state: user, barberProfile, role, theme, lang
- `artifacts/mobile/constants/i18n.ts` — FR/EN translations

## Architecture decisions

- **Auth is Clerk-first**: JWT verified via Clerk proxy middleware in the API; local user record provisioned JIT via `POST /auth/sync`. No session cookies.
- **Barbers can own multiple salons**: No unique constraint on `barbersTable.userId`. `GET /barbers/me` returns an array.
- **Mobile is public by default**: Home/discover and salon detail are unauthenticated. Booking prompts sign-in. Client tab group `(client)` requires Clerk sign-in.
- **Barber approval gate uses barber profile status** (not user account status): `(barber)/_layout.tsx` reads `barberProfile.status` from AppContext (populated from `/auth/sync` response).
- **Currency**: FC (Franc Congolais). **Language**: French default with EN toggle. **AsyncStorage keys**: `gbc.theme`, `gbc.lang`, `gbc.onboarding.v1`.
- **Mobile barber screens use `useAuthedFetch`** directly (not generated hooks) for all `/barbers/me/*` routes.

## Product

- **Mobile app**: Public home/discover (salons, search), 4-slide onboarding (first launch), public salon detail, authenticated client bookings + profile, authenticated barber dashboard (revenue by period, upcoming reservations, services, schedule/hours, clients, multi-salon selector).
- **Admin web**: Clerk-gated, admin-only. Manage barbers (approve/reject/suspend), users, financing requests, subscriptions, analytics.
- **Vitrine**: Public marketing site.
- **API**: REST, `/api` prefix, OpenAPI-documented, Clerk JWT auth.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **`pnpm run typecheck` may time out in bash** — run per-package: `pnpm --filter @workspace/<name> run typecheck`.
- **Orval naming collision**: If a component schema name matches an auto-generated response type name (e.g. `SyncAuthResponse` conflicts with operationId `syncAuth`), rename the schema (e.g. `AuthSyncResult`).
- **`getToken` from `@clerk/expo` is unstable** — do not add it to `useEffect` deps; capture via closure instead.
- **`/barbers/me` returns an array** (multi-salon). All consumers must type it as `MyBarber[]` and extract `[0]` for the primary salon.
- **Gallery delete IDOR fix**: scope `DELETE /barbers/:barberId/gallery/:photoId` by both `barberId` AND `photoId` in the WHERE clause.
- **Client reservation status**: clients may only set `cancelled`; barbers/admins can set any status.
- **Object storage has 3 backends** (`OBJECT_STORAGE_PROVIDER=local|gcs|replit`). On the VPS use `local` (disk under `LOCAL_STORAGE_DIR`, no cloud cost; back it up yourself). Local uploads flow through nginx via an HMAC-signed `PUT /api/storage/local-upload/...` (signed with `SESSION_SECRET`), so nginx `client_max_body_size` must cover image size (25m). Object-path shape stays identical across backends — clients are unchanged.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
