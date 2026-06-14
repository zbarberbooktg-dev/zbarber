# Zbarber — VPS deployment & CI/CD

This directory holds everything needed to host Zbarber on a single Ubuntu 24.04 VPS
and deploy it from GitHub Actions.

## Topology

Two independent checkouts on the VPS, one per branch:

| Environment | Branch | Checkout            | API systemd service   | API port |
| ----------- | ------ | ------------------- | --------------------- | -------- |
| Production  | `main` | `/srv/zbarber/prod` | `zbarber-api-prod`    | 5001     |
| Test        | `test` | `/srv/zbarber/test` | `zbarber-api-test`    | 5002     |

Six domains, served by nginx (TLS via certbot). The two frontends are static Vite
builds served directly by nginx; each also proxies `/api/` to its environment's API.
The `api.*` subdomains proxy everything to the API (including the Clerk proxy path
`/api/__clerk`, used by the mobile app).

| Domain                    | Serves                | Backend            |
| ------------------------- | --------------------- | ------------------ |
| `zbarber.net`             | vitrine (prod)        | proxies `/api` → 5001 |
| `admin.zbarber.net`       | admin (prod)          | proxies `/api` → 5001 |
| `api.zbarber.net`         | API (prod)            | all → 5001         |
| `test.zbarber.net`        | vitrine (test)        | proxies `/api` → 5002 |
| `admin.test.zbarber.net`  | admin (test)          | proxies `/api` → 5002 |
| `api.test.zbarber.net`    | API (test)            | all → 5002         |

The API is built **on the VPS** (esbuild externalizes `pg`, `nodemailer`,
`@google-cloud/storage`, `google-auth-library`, so `node_modules` must be present
at runtime — which is why we `pnpm install` on the server).

## Files in this directory

- `deploy.sh` — runs on the VPS (called by the Actions). `deploy.sh <vitrine|admin|api> <prod|test>`.
- `provision-vps.sh` — one-time root bootstrap (Node 24, pnpm, nginx, certbot, ufw, user, dirs).
- `systemd/zbarber-api-{prod,test}.service` — systemd units for the API.
- `nginx/*.conf` — one server block per domain (port 80; certbot adds 443).
- `env/api.env.example` — template for `/etc/zbarber/api-{prod,test}.env`.

The matching GitHub Actions live in `.github/workflows/deploy-{vitrine,api,admin}-{prod,test}.yml`.

---

## 1. Push the repo to GitHub

This is done from Replit (Git pane): create/connect a GitHub repo and push `main`.
Then create a `test` branch and push it too:

```bash
# locally / in Replit shell once connected to the GitHub remote
git checkout -b test
git push -u origin test
git checkout main
```

> `.env` files are gitignored (only `*.env.example` is tracked). Never commit real secrets.

## 2. GitHub repository secrets

Settings → Secrets and variables → Actions → **New repository secret**:

| Secret        | Value                                                        |
| ------------- | ----------------------------------------------------------- |
| `VPS_HOST`    | VPS IP or hostname                                          |
| `VPS_USER`    | `zbarber` (recommended) — the SSH user the Action logs in as |
| `VPS_SSH_KEY` | private SSH key (PEM) whose public key is authorized on the VPS |
| `VPS_PORT`    | SSH port (optional; defaults to `22`)                        |

Generate a dedicated key pair for CI:

```bash
ssh-keygen -t ed25519 -f zbarber_deploy -C "github-actions"
# put the PUBLIC key (zbarber_deploy.pub) into the zbarber user's authorized_keys
# put the PRIVATE key (zbarber_deploy) into the VPS_SSH_KEY secret
```

## 3. DNS

Point all six names at the VPS public IP with `A` (and `AAAA` if you have IPv6) records:
`zbarber.net`, `admin.zbarber.net`, `api.zbarber.net`, `test.zbarber.net`,
`admin.test.zbarber.net`, `api.test.zbarber.net`. Wait for propagation before certbot.

## 4. Provision the VPS (run once, as root)

```bash
# copy the repo's provision script over, or paste it; then:
sudo bash provision-vps.sh
```

This installs Node 24 + pnpm + nginx + certbot + ufw, creates the `zbarber` user,
`/srv/zbarber/{prod,test}`, `/etc/zbarber`, the ufw rules, and a sudoers entry that
lets `zbarber` restart only the two API services.

Authorize the CI key for the `zbarber` user:

```bash
sudo -u zbarber mkdir -p /home/zbarber/.ssh
sudo -u zbarber tee -a /home/zbarber/.ssh/authorized_keys < zbarber_deploy.pub
sudo -u zbarber chmod 700 /home/zbarber/.ssh
sudo -u zbarber chmod 600 /home/zbarber/.ssh/authorized_keys
```

## 5. Clone both checkouts (as the zbarber user)

Use a GitHub **deploy key** (read-only) or the same key, added to the repo (Settings →
Deploy keys):

```bash
sudo -iu zbarber
git clone -b main  git@github.com:<owner>/<repo>.git /srv/zbarber/prod
git clone -b test  git@github.com:<owner>/<repo>.git /srv/zbarber/test
exit
```

## 6. Environment files

```bash
sudo install -m 640 -o zbarber -g zbarber /srv/zbarber/prod/deploy/env/api.env.example /etc/zbarber/api-prod.env
sudo install -m 640 -o zbarber -g zbarber /srv/zbarber/prod/deploy/env/api.env.example /etc/zbarber/api-test.env
sudoedit /etc/zbarber/api-prod.env   # set PORT=5001, prod DATABASE_URL, real secrets
sudoedit /etc/zbarber/api-test.env   # set PORT=5002, test DATABASE_URL, real secrets
```

Use a **separate Postgres database** for prod and test. Create them and run the schema
once per environment (Drizzle push). Example (adjust connection):

```bash
sudo -iu zbarber
cd /srv/zbarber/prod && corepack enable && pnpm install --frozen-lockfile
DATABASE_URL='postgres://.../zbarber_prod' pnpm --filter @workspace/db run push
cd /srv/zbarber/test
DATABASE_URL='postgres://.../zbarber_test' pnpm --filter @workspace/db run push
exit
```

## 7. systemd services

```bash
sudo cp /srv/zbarber/prod/deploy/systemd/zbarber-api-prod.service /etc/systemd/system/
sudo cp /srv/zbarber/prod/deploy/systemd/zbarber-api-test.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now zbarber-api-prod zbarber-api-test
sudo systemctl status zbarber-api-prod zbarber-api-test
```

> The units assume the build output `dist/index.mjs` already exists. The first
> `deploy.sh ... api ...` run (step 9, or a manual `pnpm --filter @workspace/api-server build`)
> produces it. Build once before `enable --now`, or run the deploy first then start.

## 8. nginx + HTTPS

```bash
# symlink each site (or copy) into sites-enabled
for f in /srv/zbarber/prod/deploy/nginx/*.conf; do
  sudo ln -sf "$f" "/etc/nginx/sites-available/$(basename "$f")"
  sudo ln -sf "/etc/nginx/sites-available/$(basename "$f")" "/etc/nginx/sites-enabled/$(basename "$f")"
done
sudo nginx -t && sudo systemctl reload nginx

# issue certificates (certbot edits the configs to add 443 + redirect)
sudo certbot --nginx \
  -d zbarber.net -d admin.zbarber.net -d api.zbarber.net \
  -d test.zbarber.net -d admin.test.zbarber.net -d api.test.zbarber.net
```

`certbot` installs a renewal timer automatically (`systemctl status certbot.timer`).

## 9. Deploy

Triggers differ between **test** (automatic) and **prod** (manual):

- **TEST — automatic.** A push to the `test` branch triggers `deploy-test.yml`, which
  deploys all three test services **sequentially in one run** (vitrine → admin → api).
  They share the `/srv/zbarber/test` checkout, so a single run (not three parallel ones)
  avoids `git reset --hard` collisions and GitHub's per-concurrency-group cancellation.
- **PROD — manual only.** The three prod workflows are `workflow_dispatch` only
  (GitHub → Actions → pick a workflow → **Run workflow**).
- **Per-service manual redeploys.** `deploy-{vitrine,admin,api}-test.yml` are kept as
  `workflow_dispatch`-only so you can redeploy a single test service on demand without
  redeploying the whole platform.

The workflows:

- Deploy — all (test)  ← auto on push to `test`
- Deploy — vitrine (prod) / api (prod) / admin (prod)  ← manual
- Deploy — vitrine (test) / api (test) / admin (test)  ← manual, single-service

Each SSHes into the VPS, `git fetch && git reset --hard` the right branch into the
right checkout, then runs `deploy/deploy.sh <service> <env>` (pnpm install → build →
for the API, `systemctl restart`). Prod and test deploys are serialized via the
`concurrency` group so two jobs never overlap.

> **Editing `.github/workflows/*` from Replit:** Replit's GitHub connection uses an
> OAuth token without the `workflow` scope, so pushing workflow changes is rejected.
> Push them with a personal access token (PAT) that has `repo` + `workflow` scopes:
> `env -u GIT_ASKPASS GIT_TERMINAL_PROMPT=1 git -c credential.helper= -c core.askpass= push https://github.com/<owner>/<repo>.git <branch>`
> (enter your GitHub username + the PAT at the prompt; revoke the PAT afterwards).

After building/restarting, `deploy.sh` runs a **post-deploy health check**: it curls
the live domain(s) for that service (the API `/api/healthz`, plus the SPA index and
proxied `/api/healthz` for the vitrine/admin frontends), retrying briefly to let a
freshly-restarted service come up. A non-2xx (or no) response makes the script exit
non-zero, which fails the SSH step and turns the GitHub Actions run red — so a broken
deploy is obvious immediately instead of relying on manual checking.

You can also deploy by hand on the VPS:

```bash
sudo -iu zbarber
cd /srv/zbarber/prod && git pull && bash deploy/deploy.sh api prod
```

---

## Caveats / things the user must handle

- **Push to GitHub** and the **`test` branch** must be created by you (Replit Git pane / shell).
- **DNS A/AAAA records** for all six domains must be set before running certbot.
- **Object storage**: uploaded images (avatars, salon logos, gallery, before/after
  realisations, panoramas, article covers, financing docs) are stored by one of three
  backends, selected by `OBJECT_STORAGE_PROVIDER`: `local` (VPS disk — **recommended**),
  `gcs` (paid Google Cloud Storage), or `replit` (sidecar; Replit-only fallback).

  **Local disk (recommended — no per-GB or egress cost).** Per environment, in
  `/etc/zbarber/api-{prod,test}.env` set `OBJECT_STORAGE_PROVIDER=local` and
  `LOCAL_STORAGE_DIR` to a writable, per-env directory, then create it:
  ```bash
  sudo mkdir -p /srv/zbarber/storage/prod /srv/zbarber/storage/test
  sudo chown -R zbarber:zbarber /srv/zbarber/storage
  # api-prod.env → LOCAL_STORAGE_DIR=/srv/zbarber/storage/prod
  # api-test.env → LOCAL_STORAGE_DIR=/srv/zbarber/storage/test
  ```
  How it works: the client requests an upload URL (`POST /api/storage/uploads/request-url`)
  and the API returns an **HMAC-signed, 15-min** URL pointing back at itself
  (`PUT /api/storage/local-upload/uploads/<uuid>`, signed with `SESSION_SECRET`). The
  upload therefore flows **through nginx**, so `client_max_body_size` must cover the
  largest image — it's already `25m` in `nginx/api*.conf`, and the API enforces the same
  25 MiB cap. No GCS account, key, or bucket vars are needed; `PRIVATE_OBJECT_DIR` /
  `PUBLIC_OBJECT_SEARCH_PATHS` / `GCS_*` are ignored.

  ⚠️ **Backups are your responsibility.** Local disk has no redundancy. Back up
  `/srv/zbarber/storage/` regularly (e.g. a nightly `rsync`/cron to another disk or host).
  Losing that directory loses every uploaded image.

  **Google Cloud Storage (optional, paid).** Alternatively set
  `OBJECT_STORAGE_PROVIDER=gcs` and provide a service-account key
  (`GOOGLE_APPLICATION_CREDENTIALS=<path>` or `GCS_CREDENTIALS_JSON=<inline>`) plus the
  bucket layout vars `PRIVATE_OBJECT_DIR` / `PUBLIC_OBJECT_SEARCH_PATHS` (first path
  segment = bucket name; the service account needs **Storage Object Admin** + URL
  signing). See `env/api.env.example` for the full walkthrough. If `OBJECT_STORAGE_PROVIDER`
  is unset and no `LOCAL_STORAGE_DIR`/credentials are present, the API falls back to the
  Replit sidecar (Replit-only).

  **Confirm it works** (run once per environment after the env file is in place). The
  smoke test is bundled with the API build (`dist/scripts/storageSmoke.mjs`) and exercises
  the full upload + download/serve cycle (and ACL round-trip on GCS) using the same code
  the API serves with:

  ```bash
  sudo -iu zbarber
  # The API build (deploy/deploy.sh api <env>) produces dist/scripts/storageSmoke.mjs.
  cd /srv/zbarber/prod/artifacts/api-server
  node --env-file=/etc/zbarber/api-prod.env dist/scripts/storageSmoke.mjs   # prod
  cd /srv/zbarber/test/artifacts/api-server
  node --env-file=/etc/zbarber/api-test.env dist/scripts/storageSmoke.mjs   # test
  ```

  A green `✓ Storage smoke test PASSED (provider: local)` for both prod and test
  confirms photos upload and display correctly on the live server. The script creates
  and then deletes its own throwaway objects, so it leaves the storage dir clean.
- **Separate databases** for prod and test; run `@workspace/db push` once per env.
- **Clerk**: use the live/production Clerk keys in `api-prod.env` and the appropriate
  keys in `api-test.env`. The mobile app must point `EXPO_PUBLIC_DOMAIN` at
  `api.zbarber.net` (prod) / `api.test.zbarber.net` (test).
- **First API start** needs `dist/index.mjs` to exist (build before `systemctl enable --now`,
  or run the API deploy first).
