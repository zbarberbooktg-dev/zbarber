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
