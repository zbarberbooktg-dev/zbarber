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

Everything after the one-time setup is **manual** — each workflow is
`workflow_dispatch` only (GitHub → Actions → pick a workflow → **Run workflow**).
There are six, one per domain:

- Deploy — vitrine (prod) / api (prod) / admin (prod)
- Deploy — vitrine (test) / api (test) / admin (test)

Each one SSHes into the VPS, `git fetch && git reset --hard` the right branch into the
right checkout, then runs `deploy/deploy.sh <service> <env>` (pnpm install → build →
for the API, `systemctl restart`). Prod and test deploys are serialized via the
`concurrency` group so two prod jobs never overlap.

You can also deploy by hand on the VPS:

```bash
sudo -iu zbarber
cd /srv/zbarber/prod && git pull && bash deploy/deploy.sh api prod
```

---

## Caveats / things the user must handle

- **Push to GitHub** and the **`test` branch** must be created by you (Replit Git pane / shell).
- **DNS A/AAAA records** for all six domains must be set before running certbot.
- **Object storage**: images are stored in Google Cloud Storage. On Replit a managed
  sidecar brokers credentials; on the VPS the API talks to a **real GCS bucket** using a
  service-account key. You must, per environment (prod + test):
  1. Create a GCS bucket (e.g. `zbarber-prod`, `zbarber-test`).
  2. Create a service account with **Storage Object Admin** on the bucket and the ability
     to sign URLs (a downloaded JSON key includes a private key, which is what V4 signing
     needs).
  3. Drop the JSON key on the VPS (e.g. `/etc/zbarber/gcs-prod-sa.json`, `chmod 600`,
     owned by `zbarber`).
  4. In `/etc/zbarber/api-{prod,test}.env` set `OBJECT_STORAGE_PROVIDER=gcs`,
     `GOOGLE_APPLICATION_CREDENTIALS=<path to key>` (or `GCS_CREDENTIALS_JSON=<inline>`),
     and the bucket layout vars `PRIVATE_OBJECT_DIR` / `PUBLIC_OBJECT_SEARCH_PATHS`
     (first path segment is the bucket name). See `env/api.env.example`.

  With those set, image upload (presigned PUT) and serving work end-to-end off Replit.
  If `OBJECT_STORAGE_PROVIDER` is unset and no credentials are present, the API falls
  back to the Replit sidecar (which only works on Replit).
- **Separate databases** for prod and test; run `@workspace/db push` once per env.
- **Clerk**: use the live/production Clerk keys in `api-prod.env` and the appropriate
  keys in `api-test.env`. The mobile app must point `EXPO_PUBLIC_DOMAIN` at
  `api.zbarber.net` (prod) / `api.test.zbarber.net` (test).
- **First API start** needs `dist/index.mjs` to exist (build before `systemctl enable --now`,
  or run the API deploy first).
