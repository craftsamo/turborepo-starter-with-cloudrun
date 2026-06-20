---
name: manage-deploy-secrets
description: Use when adding or rotating a Secret Manager secret consumed by a Cloud Run app — keeping the three coupled places in sync (the GitHub Secret, the per-app MAP in deployment-common.yml, and the secretKeyRef in service.yaml). Covers the ${REPO_NAME}-${ENVIRONMENT}- name prefix, key latest, version churn, and the runtime secretAccessor role. Trigger keywords: "add secret", "Secret Manager", "secretKeyRef", "rotate secret", "env var to Cloud Run", "UPSTASH".
license: MIT
compatibility: opencode
metadata:
  category: implementation
  package: repo
  stack: secret-manager,cloud-run,github-actions
---

<Goal>

Add or rotate a Secret Manager secret that a Cloud Run app reads at runtime,
keeping the three coupled definitions in sync so the secret actually mounts.

</Goal>

<Scope>

The same secret is referenced in **three** places that must agree:

1. **GitHub Secret** — the raw value (`gh secret set`), repo- or
   environment-scoped.
2. **`.github/workflows/deployment-common.yml`** — the per-app `MAP` branch that
   upserts it to Secret Manager under
   `PREFIX="${{ inputs.repo_name }}-${{ inputs.environment }}"`.
3. **`apps/<app>/service.yaml`** — the `secretKeyRef` that mounts it, named
   `${REPO_NAME}-${ENVIRONMENT}-<VAR>`, `key: latest`.

The runtime SA already has `roles/secretmanager.secretAccessor` (from
`nps setup.google.cloudrun`) — no IAM change needed.

</Scope>

<Steps>

1. **GitHub Secret** — `gh secret set <VAR>` (add `--env <environment>` for a
   per-environment value).
2. **Workflow MAP** — in `deployment-common.yml`, under the app's branch (create
   one if absent):
   ```bash
   if [ "${{ inputs.app_name }}" == "<app>" ]; then
     MAP["<VAR>"]="${{ secrets.<VAR> }}"
   fi
   ```
   The workflow creates/updates the Secret Manager secret
   `${repo}-${env}-<VAR>` (it always adds a new version).
3. **service.yaml secretKeyRef** — in `apps/<app>/service.yaml`, add to the
   container `env`:
   ```yaml
   - name: <VAR>
     valueFrom:
       secretKeyRef:
         name: ${REPO_NAME}-${ENVIRONMENT}-<VAR>
         key: latest
   ```
   The `name` prefix MUST equal the workflow `PREFIX`.
4. **Build-time only** — if the value is needed at build (turbo cache key), also
   add `<VAR>` to `apps/<app>/turbo.json` `build.env`. Runtime-only secrets do
   NOT go there.
5. **Rotate** — update the GitHub Secret, then redeploy; the workflow adds a new
   Secret Manager version and `key: latest` picks it up. A pure rotation needs no
   manifest change.

</Steps>

<Verify>

- Names match exactly: `deployment-common.yml` PREFIX + `<VAR>` ==
  `service.yaml` `secretKeyRef.name`.
- After a deploy: `gcloud secrets versions list ${repo}-${env}-<VAR>` shows a new
  version; the Cloud Run revision is healthy and the env var is present.

</Verify>

<AntiPatterns>

- Prefix mismatch between the workflow and `service.yaml` — the secret won't
  mount and the revision fails. The two must stay in sync.
- Putting a secret in a plain `env: value:` of `service.yaml` — use
  `secretKeyRef`.
- Expecting unchanged values to be skipped — every deploy adds a NEW Secret
  Manager version (no value compare); old versions are not auto-disabled.
- An environment-scoped secret not defined in the matching GitHub Environment —
  `secrets.<VAR>` resolves empty.
- Forgetting that a brand-new app needs its own `if app_name == <app>` MAP branch
  (see `add-cloudrun-app`).

</AntiPatterns>
