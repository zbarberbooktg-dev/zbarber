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
