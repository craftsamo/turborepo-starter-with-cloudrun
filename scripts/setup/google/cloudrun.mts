/**
 * Cloud Run setup (depends on the foundation in `cloud.mts`).
 *
 * Creates the Cloud Run runtime service account, grants the GitHub Workflows
 * service account the permissions it needs to deploy Cloud Run, lets GitHub
 * Actions impersonate the runtime account, and enables the related APIs.
 *
 *   node scripts/setup/google/cloudrun.mts [--dry-run]
 *   nps setup.google.cloudrun
 */
import {
  DRY_RUN,
  bindProjectRole,
  bindServiceAccountRole,
  enableService,
  ensureServiceAccount,
  getProjectContext,
  log,
  logError,
  serviceAccountEmail,
  serviceAccountExists,
} from './lib.mts';

const ctx = getProjectContext();
if (DRY_RUN) log('Running in --dry-run mode: no resources will be created.');

const githubSa = `${ctx.packageName}-github-sa`;
const githubSaEmail = serviceAccountEmail(githubSa, ctx.projectId);
const githubSaMember = `serviceAccount:${githubSaEmail}`;

const cloudrunSa = `${ctx.packageName}-cloudrun-sa`;
const cloudrunSaEmail = serviceAccountEmail(cloudrunSa, ctx.projectId);
const cloudrunSaMember = `serviceAccount:${cloudrunSaEmail}`;

const poolBase = `iam.googleapis.com/projects/${ctx.projectNumber}/locations/global/workloadIdentityPools/${ctx.poolId}`;

// Cloud Run setup builds on the foundation. Fail fast with guidance if the
// GitHub Workflows service account has not been created yet.
if (!DRY_RUN && !serviceAccountExists(githubSaEmail, ctx.projectId)) {
  logError(
    `GitHub workflows service account not found: ${githubSa}.\n` +
      '  Run `nps setup.google.cloud` first (or `nps setup.google`).',
  );
  process.exit(1);
}

// 1) Cloud Run runtime service account.
ensureServiceAccount({
  accountId: cloudrunSa,
  projectId: ctx.projectId,
  displayName: 'Cloud Run Service Account',
  description: 'Manages Cloud Run runtime permissions',
});

// 2) Deploy permissions for github-sa (Cloud Run specific).
for (const role of [
  'roles/run.admin',
  'roles/artifactregistry.admin',
  'roles/secretmanager.admin',
]) {
  bindProjectRole(ctx.projectId, githubSaMember, role);
}
log('Bound Cloud Run deploy roles to GitHub workflows service account.');

// 3) Runtime permissions for the Cloud Run service account.
for (const role of [
  'roles/logging.logWriter',
  'roles/monitoring.metricWriter',
  'roles/run.admin',
  'roles/secretmanager.secretAccessor',
]) {
  bindProjectRole(ctx.projectId, cloudrunSaMember, role);
}
log('Bound runtime IAM roles to Cloud Run service account.');

// 4) Allow GitHub Actions from this repository to impersonate cloudrun-sa.
bindServiceAccountRole({
  saEmail: cloudrunSaEmail,
  projectId: ctx.projectId,
  role: 'roles/iam.workloadIdentityUser',
  member: `principalSet://${poolBase}/attribute.repository/${ctx.repoOwner}/${ctx.repoName}`,
});
log('Bound workload identity (repository) to Cloud Run service account.');

// 5) Enable the Cloud Run related APIs.
for (const service of [
  'run.googleapis.com',
  'artifactregistry.googleapis.com',
  'secretmanager.googleapis.com',
]) {
  enableService(service, ctx.projectId);
}

log('Google Cloud Run setup complete.');
