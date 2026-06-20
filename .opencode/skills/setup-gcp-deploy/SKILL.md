---
name: setup-gcp-deploy
description: Use when bootstrapping keyless Cloud Run deployment for a fresh fork/clone — provisioning Workload Identity Federation + service accounts via nps setup.google, and configuring the required GitHub Secrets, Variables, and Environments. Covers the four GOOGLE_CLOUD_* env vars, DRY_RUN preview, gh secret/variable set, and the production-from-main guard. Trigger keywords: "setup gcp", "workload identity", "first deploy", "nps setup.google", "bootstrap deployment", "github secrets".
license: MIT
compatibility: opencode
metadata:
  category: workflow
  package: repo
  stack: gcloud,workload-identity,github-actions
---

<Goal>

Bootstrap keyless GitHub Actions → Cloud Run deployment for a fresh fork:
provision the WIF/IAM foundation with `nps setup.google`, then set the GitHub
Secrets / Variables / Environments the deploy workflow reads.

</Goal>

<Scope>

- Local provisioning: `scripts/setup/google/{cloud,cloudrun,lib}.mts` via
  `nps setup.google` (`cloud` → `cloudrun`, order enforced; idempotent;
  `--dry-run`-aware).
- Required local env: root `.env` (from `.env.example`) — four `GOOGLE_CLOUD_*`
  vars.
- GitHub config consumed by `.github/workflows/deployment*.yml`: Secrets,
  Variables, Environments.
- Prereqs: `gcloud` authenticated, Node ≥ 24, run from the repo root.
- Names derive from the root `package.json` `name` (`*-github-sa` deployer,
  `*-cloudrun-sa` runtime).
- Related skills: app-level secrets → `manage-deploy-secrets`; adding an app →
  `add-cloudrun-app`.

</Scope>

<Steps>

1. **Prereqs** — `gcloud auth login` (an account with IAM admin / project owner)
   and `gcloud config set project <id>`. Node ≥ 24 (the `.mts` scripts run
   directly). Run everything from the repo root.
2. **Local `.env`** — copy `.env.example` → `.env` and fill:
   `GOOGLE_CLOUD_PROJECT_ID`, `GOOGLE_CLOUD_PROJECT_NUMBER` (from the console),
   `GOOGLE_CLOUD_IDENTITY_POOL_ID`, `GOOGLE_CLOUD_IDENTITY_PROVIDER_ID` (any
   unique IDs you choose). Shell/Keychain env overrides the file.
3. **Preview** — `DRY_RUN=1 nps setup.google` prints every gcloud command
   (offline-safe, no mutations).
4. **Provision** — `nps setup.google` (runs `setup.google.cloud` then
   `setup.google.cloudrun`). Creates the WIF pool/provider, `*-github-sa`
   (deployer) + `*-cloudrun-sa` (runtime), the IAM bindings, and enables the
   APIs. Idempotent and re-runnable (no rollback on partial failure).
5. **GitHub Secrets** (`gh secret set <NAME>`; add `--env <environment>` for
   per-environment values):
   - `GOOGLE_CLOUD_PROJECT_ID`, `GOOGLE_CLOUD_PROJECT_NUMBER`,
     `GOOGLE_CLOUD_IDENTITY_POOL_ID`, `GOOGLE_CLOUD_IDENTITY_PROVIDER_ID`
   - per-app secrets as needed (web: `UPSTASH_REDIS_REST_URL`,
     `UPSTASH_REDIS_REST_TOKEN`) — see `manage-deploy-secrets`.
6. **GitHub Variables** (`gh variable set <NAME>`):
   `GOOGLE_CLOUD_REGION` (e.g. `asia-northeast1`); `DOMAIN` (optional custom
   domain).
7. **GitHub Environments** — create `production` and `development` (the deploy job
   uses `environment:` for scoping; `production` only deploys from `main`). E.g.
   `gh api -X PUT repos/{owner}/{repo}/environments/production`.
8. **First deploy** — Actions → Deployment → `workflow_dispatch` with
   `targets=web`, `environment=development`.

</Steps>

<Verify>

- `DRY_RUN=1 nps setup.google` completes without error.
- After the real run:
  `gcloud iam workload-identity-pools list --location=global` and
  `gcloud iam service-accounts list` show the pool and `*-github-sa` /
  `*-cloudrun-sa`.
- `gh secret list` / `gh variable list` show the expected names.
- A `development` deploy succeeds end-to-end.

</Verify>

<AntiPatterns>

- Running outside the repo root — `.env` and `package.json` are read
  CWD-relative.
- Missing any of the four `GOOGLE_CLOUD_*` vars — the scripts `exit(1)`.
- Putting `GOOGLE_CLOUD_REGION` / `DOMAIN` in Secrets — they are **Variables**
  (`vars.*`); the project/pool/provider IDs are **Secrets**.
- Renaming the root `package.json` `name` after setup — SA names change and
  orphan the old service accounts.
- Expecting the scripts to create the Artifact Registry repo / secrets / the
  service — they don't; the deploy workflow does. Setup only handles
  identity/IAM/API.
- Committing `.env` — it holds project identifiers; keep it untracked.

</AntiPatterns>
