---
name: VPS deploy operational gotchas
description: Non-obvious things when bringing the Express API up on the VPS via systemd (env files, health check semantics).
---

# VPS deploy: API bring-up gotchas

**`/api/healthz` does NOT touch the database.** It returns `{"status":"ok"}` even when
the DB connection is misconfigured. A green healthz (or a green deploy.sh health check)
therefore does NOT prove DB connectivity.
**How to apply:** after first start / any env change, also check
`journalctl -u zbarber-api-<env>` for `_DrizzleQueryError ... password authentication
failed`. Real DB proof = the `Root admin seeded` log line (a successful write), not healthz.

**Env files come from `deploy/env/api.env.example` with placeholder values.** The
template ships `DATABASE_URL=postgres://user:password@127.0.0.1:5432/zbarber_prod`. If
left unedited, the masked `<SET>` check still passes (value is non-empty) but the API
fails every query with `password authentication failed for user "user"`. Always replace
DATABASE_URL with the real `zbarber:<pw>` creds and the correct db name (`zbarber_prod`
vs `zbarber_test`) per env. Same applies to `OBJECT_STORAGE_PROVIDER=gcs` +
`GOOGLE_APPLICATION_CREDENTIALS` and `SMTP_*` — placeholders that fail at use-time, not boot.

**systemd reads `EnvironmentFile` as root** before dropping to `User=zbarber`, so the
`/etc/zbarber/*.env` files being root-only (zbarber gets Permission denied reading them
directly) does NOT stop the service from starting.

**"active (running)" right after `enable --now` can be misleading** — the node server
takes ~2s to bind the port. A `curl` fired immediately gets connection-refused even
though nothing crashed. `sleep 3` before curling.

## Pushing `.github/workflows/*` changes from a Replit repl

Replit's GitHub connection uses an **OAuth token without the `workflow` scope**, so any
push that creates/updates a file under `.github/workflows/` is rejected by GitHub with
`refusing to allow an OAuth App to create or update workflow ... without 'workflow' scope`.
The whole push (all refs) is rejected, not just the workflow commit.

The OAuth token is injected via **`GIT_ASKPASS`** (a script that auto-returns the token),
NOT via a credential helper or `http.extraheader` — so `-c credential.helper=` alone does
nothing and no prompt appears. `GIT_TERMINAL_PROMPT` is also disabled.
**How to apply:** push with a personal access token (PAT) that has `repo` + `workflow`
scopes, forcing git to prompt instead of using the injected token:
```
env -u GIT_ASKPASS GIT_TERMINAL_PROMPT=1 git -c credential.helper= -c core.askpass= \
  push https://github.com/<owner>/<repo>.git <branch>
```
At the prompt enter the GitHub username + the PAT as password (keeps PAT out of shell
history). After this, advise the user to revoke/rotate the PAT.

## Don't fan out N workflows sharing one concurrency group on a single trigger

The 3 test deploy workflows all used `concurrency.group: deploy-test`
(`cancel-in-progress: false`). That serializes *manual* runs fine, but when ONE push to
`test` triggered all three at once, GitHub keeps only **one pending run per group**: it
runs the first, queues the second, and **cancels** it the instant the third enters the
group (cancelled in ~1s). `cancel-in-progress: false` does NOT prevent this — it only
governs the *in-progress* run, not the already-pending one.
**Why it matters here:** all three deploy into the same `/srv/zbarber/test` checkout and
do `git reset --hard`, so they must NOT run in parallel either.
**How to apply:** for "deploy everything on push", use a **single** workflow that runs
the services sequentially in one job (one `git reset` + `deploy.sh a`, `deploy.sh b`,
`deploy.sh c`). Keep the per-service workflows as `workflow_dispatch`-only for targeted
manual redeploys.
