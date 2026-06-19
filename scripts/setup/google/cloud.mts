/**
 * Google Cloud foundation setup (run once per project).
 *
 * Provisions the project-level identity plumbing shared by every deployment
 * target: Workload Identity Federation for GitHub Actions and the GitHub
 * Workflows service account that CI impersonates. Service-specific setup
 * (Cloud Run, …) lives in sibling scripts and depends on this having run.
 *
 *   node scripts/setup/google/cloud.mts [--dry-run]
 *   nps setup.google.cloud
 */
import {
  DRY_RUN,
  bindProjectRole,
  bindServiceAccountRole,
  enableService,
  ensureServiceAccount,
  ensureWorkloadIdentityPool,
  ensureWorkloadIdentityProvider,
  getProjectContext,
  log,
  serviceAccountEmail,
} from './lib.mts';

const ctx = getProjectContext();
if (DRY_RUN) log('Running in --dry-run mode: no resources will be created.');

const githubSa = `${ctx.packageName}-github-sa`;
const githubSaEmail = serviceAccountEmail(githubSa, ctx.projectId);
const githubSaMember = `serviceAccount:${githubSaEmail}`;

const poolBase = `iam.googleapis.com/projects/${ctx.projectNumber}/locations/global/workloadIdentityPools/${ctx.poolId}`;

// 1) Workload Identity Federation (GitHub OIDC).
ensureWorkloadIdentityPool(ctx.poolId, ctx.projectId);
ensureWorkloadIdentityProvider({
  providerId: ctx.providerId,
  poolId: ctx.poolId,
  projectId: ctx.projectId,
  repoOwner: ctx.repoOwner,
});

// 2) GitHub Workflows service account (the identity CI deploys as).
ensureServiceAccount({
  accountId: githubSa,
  projectId: ctx.projectId,
  displayName: 'Github Workflows Account',
  description: 'Manages GitHub Actions authentication and deployment access',
});

// 3) Baseline roles needed to act as runtime service accounts (any target).
for (const role of ['roles/iam.serviceAccountUser', 'roles/iam.serviceAccountTokenCreator']) {
  bindProjectRole(ctx.projectId, githubSaMember, role);
}
log('Bound baseline IAM roles to GitHub workflows service account.');

// 4) Allow GitHub Actions from this repository to impersonate github-sa
//    (main branch via the OIDC subject, plus the whole repository).
bindServiceAccountRole({
  saEmail: githubSaEmail,
  projectId: ctx.projectId,
  role: 'roles/iam.workloadIdentityUser',
  member: `principal://${poolBase}/subject/repo:${ctx.repoOwner}/${ctx.repoName}:ref:refs/heads/main`,
});
log('Bound workload identity (main branch) to GitHub workflows service account.');

bindServiceAccountRole({
  saEmail: githubSaEmail,
  projectId: ctx.projectId,
  role: 'roles/iam.workloadIdentityUser',
  member: `principalSet://${poolBase}/attribute.repository/${ctx.repoOwner}/${ctx.repoName}`,
});
log('Bound workload identity (repository) to GitHub workflows service account.');

// 5) Enable the foundational API used for authentication.
enableService('iamcredentials.googleapis.com', ctx.projectId);

log('Google Cloud foundation setup complete.');
