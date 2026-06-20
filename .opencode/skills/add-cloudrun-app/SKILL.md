---
name: add-cloudrun-app
description: Use when adding a new deployable app under apps/<name> and wiring it into the Cloud Run matrix deploy (Dockerfile, service.yaml, turbo.json, deployment workflow). Covers the app-name charset rule, the PORT 8080 contract, the default+override runtime service account seam, the per-app Secret Manager MAP seam, and the deploy-target extension seam. Trigger keywords: "add app", "apps/api", "new Cloud Run service", "deploy new app", "service.yaml", "Dockerfile".
license: MIT
compatibility: opencode
metadata:
  category: implementation
  package: repo
  stack: cloud-run,docker,turbo,github-actions
---

<Goal>

Add a new deployable app under `apps/<name>` and wire it into the existing
Cloud Run matrix deploy, reusing the generalized `deployment-common.yml`
(no per-app SERVICE_ACCOUNT / BASE_URL edits needed).

</Goal>

<Scope>

- New app: `apps/<name>/` — `package.json`, `Dockerfile`, `service.yaml`,
  `turbo.json`.
- Deploy is metadata-driven: the matrix auto-discovers apps from
  `apps/**/package.json` via `.github/workflows/get-details.yml`. You deploy via
  GitHub Actions `workflow_dispatch` (`targets`, `environment`) — there is no
  `nps deploy`.
- Canonical template: `apps/web/*`.
- Shared workflow: `.github/workflows/deployment-common.yml` (runtime SA default
  + per-app secret MAP seam).
- Related skills: secrets → `manage-deploy-secrets`; first-time GCP foundation →
  `setup-gcp-deploy`.

</Scope>

<Steps>

1. **`apps/<name>/package.json`** — `name` MUST be `[a-zA-Z0-9]` only. The deploy
   validation rejects anything else, and the Cloud Run service name becomes
   `$PROJECT_NAME-$APP_NAME-$ENVIRONMENT` (no hyphens/uppercase in `<name>`). Set
   `private: true` and provide `build` / `start` scripts turbo can run (mirror
   `apps/web/package.json`).
2. **`apps/<name>/Dockerfile`** — multi-stage, turbo-pruned
   (`turbo prune --scope=<name> --docker`). The runtime stage MUST listen on
   **`PORT=8080`** with `HOSTNAME=0.0.0.0` (the `service.yaml` startupProbe and
   Cloud Run's default port are 8080). Copy `apps/web/Dockerfile` and swap
   `web` → `<name>`. Build context is the repo root; the deploy builds
   `./apps/<name>/Dockerfile`.
3. **`apps/<name>/service.yaml`** — copy `apps/web/service.yaml`. Keep the
   `${...}` envsubst placeholders (`CLOUD_RUN_SERVICE_NAME`, `SERVICE_ACCOUNT`,
   `CONTAINER_IMAGE`, `ENVIRONMENT`, `REPO_NAME`, `BASE_URL`, `LOG_FORMAT`).
   Adjust `resources`, `containerConcurrency`, `autoscaling` maxScale, and the
   startupProbe path/port for the app. Drop the web-only secret env unless this
   app needs them (step 5).
4. **`apps/<name>/turbo.json`** — `{"extends": ["//"], "tasks": {"build": {…}}}`
   mirroring `apps/web/turbo.json`; declare build-time env in `build.env`.
5. **Secrets (optional)** — if the app reads Secret Manager values, follow
   `manage-deploy-secrets`: add a per-app `MAP` branch in `deployment-common.yml`,
   a `secretKeyRef` in `service.yaml`, and the GitHub Secret.
6. **Runtime service account** — none needed. `deployment-common.yml` now sets
   the shared `*-cloudrun-sa` as the default for every app. Add a per-app override
   block there ONLY if this app genuinely needs a different SA.
7. **Deploy-target seam** — this repo deploys to Cloud Run. Downstream forks may
   add other targets (e.g. a `deploy_target` input for Compute Engine); keep app
   wiring target-agnostic and let those forks extend the seam on sync.

</Steps>

<Verify>

- `nps build` — turbo builds the new app (its `build` task runs).
- `nps typecheck` / `nps lint` — workspace-wide; includes the new app.
- Local image: `docker build -f apps/<name>/Dockerfile -t <name> .`, run it, and
  curl `http://localhost:8080/`.
- Deploy: Actions → Deployment → `workflow_dispatch` with `targets=<name>`,
  `environment=development`. Confirm the Cloud Run URL responds and the revision
  is healthy (startupProbe passes).

</Verify>

<AntiPatterns>

- App name with hyphens/uppercase — rejected by deploy validation; keep
  `[a-zA-Z0-9]`.
- Container not on 8080 — the startupProbe never passes and the revision stays
  unhealthy.
- Re-adding a web-only `if [ "$APP_NAME" == "web" ]` SA branch — the runtime SA
  is now a shared default; don't reintroduce per-app branches unless the SA truly
  differs.
- `secretKeyRef.name` not matching the workflow PREFIX
  `${REPO_NAME}-${ENVIRONMENT}-` — the secret won't mount (see
  `manage-deploy-secrets`).
- Deploying `production` from a non-`main` branch — blocked by the workflow guard.
- Adding `nps`/CI entries that hardcode `web` — keep new tooling app-parameterized.

</AntiPatterns>
