---
name: pnpm build-script allowlist (off-Replit installs)
description: Why pnpm install fails with ERR_PNPM_IGNORED_BUILDS on the VPS/CI but not on Replit.
---

# pnpm `onlyBuiltDependencies` must list every build-script dep

On a fresh `pnpm install` **off Replit** (VPS, GitHub Actions), pnpm 11 refuses to run
dependency build/postinstall scripts unless the package is in
`pnpm-workspace.yaml > onlyBuiltDependencies`. Any unlisted package with a build script
makes pnpm print `ERR_PNPM_IGNORED_BUILDS` and **exit non-zero**, which aborts the
install — and therefore aborts `deploy.sh` (it runs `pnpm install`) and any
`pnpm run <script>` that triggers a deps-status check.

**Why it's invisible on Replit:** the Replit environment auto-approves build scripts, so
installs succeed there even when the allowlist is incomplete. The failure only shows up
on the VPS/CI.

**How to apply:** when an off-Replit install reports `ERR_PNPM_IGNORED_BUILDS: Ignored
build scripts: A, B, C`, add each named package to `onlyBuiltDependencies` in
`pnpm-workspace.yaml`, commit, and redeploy. Validate locally with
`pnpm install --frozen-lockfile` (exit 0, scripts run). The change does NOT touch the
lockfile. Known ones needed for this repo: `esbuild`, `@swc/core`, `msw`,
`unrs-resolver`, `@clerk/shared`, `browser-tabs-lock`, `core-js`.

**Stale-state gotcha:** if `node_modules` was created by an earlier install that ran
*before* the allowlist was fixed, a later `pnpm install` says "Already up to date",
**skips** the build phase, and keeps re-printing the same `ERR_PNPM_IGNORED_BUILDS`
(even for packages that ARE allowlisted, like esbuild). The warning is cached in the
existing `node_modules`. Fix: delete node_modules and reinstall — `find . -name
node_modules -type d -prune -exec rm -rf {} +` then `pnpm install --frozen-lockfile`
(or `pnpm rebuild`). Symptom tell: esbuild listed as ignored despite being allowlisted
== build phase was skipped, not an allowlist problem.
