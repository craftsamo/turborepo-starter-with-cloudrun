/**
 * Shared helpers for the Google Cloud setup scripts (`cloud.mts`,
 * `cloudrun.mts`).
 *
 * Configuration (`GOOGLE_CLOUD_*`) is read from `process.env`, with a root
 * `.env` file loaded as a fallback (without overriding values already present
 * in the environment). See `.env.example` for the required variables.
 *
 * Run with `--dry-run` (or `DRY_RUN=1`) to print the `gcloud` commands instead
 * of executing them — useful for previewing a provisioning run safely.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** When true, mutating `gcloud` commands are printed instead of executed. */
export const DRY_RUN = process.argv.includes('--dry-run') || Boolean(process.env.DRY_RUN);

export interface ProjectContext {
  projectId: string;
  projectNumber: string;
  poolId: string;
  providerId: string;
  repoOwner: string;
  repoName: string;
  packageName: string;
}

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

// ---------------------------------------------------------------------------
// Logging (console only)
// ---------------------------------------------------------------------------

function timestamp(): string {
  return new Date().toISOString();
}

export function log(message: string): void {
  console.log(`${timestamp()} - ${message}`);
}

export function logError(message: string): void {
  console.error(`${timestamp()} - ERROR: ${message}`);
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

let dotenvLoaded = false;

function loadDotenvOnce(): void {
  if (dotenvLoaded) return;
  dotenvLoaded = true;
  try {
    // Built-in loader (Node >= 20.12). Already-set variables (e.g. injected
    // from the Keychain, or exported in the shell) take precedence over the
    // file, which is exactly the precedence we want.
    process.loadEnvFile();
  } catch {
    // No `.env` at the repo root — rely on `process.env` only.
  }
}

export function getRequiredEnv(name: string): string {
  loadDotenvOnce();
  const value = process.env[name];
  if (!value) {
    logError(
      `Missing required environment variable: ${name}.\n` +
        `  Set it in a root .env file (see .env.example) or export it in your` +
        ` shell environment.`,
    );
    process.exit(1);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Command execution
// ---------------------------------------------------------------------------

function formatArg(arg: string): string {
  return /[\s"'$]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}

function formatCommand(command: string, args: string[]): string {
  return [command, ...args.map(formatArg)].join(' ');
}

function run(command: string, args: string[], options: { capture?: boolean } = {}): RunResult {
  const result = spawnSync(command, args, {
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
  });
  if (result.error) {
    const code = (result.error as { code?: string }).code;
    if (code === 'ENOENT') {
      logError(`Command not found: ${command}. Is it installed and on PATH?`);
    } else {
      logError(`Failed to run ${command}: ${result.error.message}`);
    }
    process.exit(1);
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

/**
 * Run a `gcloud` command. Mutating commands are skipped (only printed) when
 * `DRY_RUN` is set. Read-only `capture` commands always run so callers can
 * inspect their output; callers gate those behind `!DRY_RUN`.
 */
export function gcloud(
  args: string[],
  options: { capture?: boolean; allowFail?: boolean } = {},
): RunResult {
  if (DRY_RUN && !options.capture) {
    log(`[dry-run] ${formatCommand('gcloud', args)}`);
    return { status: 0, stdout: '', stderr: '' };
  }
  const result = run('gcloud', args, { capture: options.capture });
  if (result.status !== 0 && !options.allowFail) {
    logError(`${formatCommand('gcloud', args)}\n  exited with status ${result.status}`);
    process.exit(1);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Project context (env + git + package.json)
// ---------------------------------------------------------------------------

function gitRemoteUrl(): string {
  const result = run('git', ['config', '--get', 'remote.origin.url'], {
    capture: true,
  });
  const url = result.stdout.trim();
  if (result.status !== 0 || !url) {
    logError('Unable to read git remote.origin.url. Run inside the repository.');
    process.exit(1);
  }
  return url;
}

function parseRepo(url: string): { owner: string; name: string } {
  // Supports both `git@host:owner/name(.git)` and
  // `https://host/owner/name(.git)` (with optional trailing slash).
  const cleaned = url.replace(/\/$/, '').replace(/\.git$/, '');
  const match = cleaned.match(/[:/]([^/]+)\/([^/]+)$/);
  if (!match) {
    logError(`Unable to parse owner/name from remote URL: ${url}`);
    process.exit(1);
  }
  return { owner: match[1], name: match[2] };
}

function readPackageName(): string {
  try {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      name?: string;
    };
    if (!pkg.name) throw new Error('`name` field is empty');
    return pkg.name;
  } catch (error) {
    logError(`Could not read name from package.json: ${(error as Error).message}`);
    process.exit(1);
  }
}

export function getProjectContext(): ProjectContext {
  const projectId = getRequiredEnv('GOOGLE_CLOUD_PROJECT_ID');
  const projectNumber = getRequiredEnv('GOOGLE_CLOUD_PROJECT_NUMBER');
  const poolId = getRequiredEnv('GOOGLE_CLOUD_IDENTITY_POOL_ID');
  const providerId = getRequiredEnv('GOOGLE_CLOUD_IDENTITY_PROVIDER_ID');
  const { owner, name } = parseRepo(gitRemoteUrl());
  const packageName = readPackageName();

  log(`Project: ${projectId} (#${projectNumber})`);
  log(`Repository: ${owner}/${name}`);
  log(`Package: ${packageName}`);

  return {
    projectId,
    projectNumber,
    poolId,
    providerId,
    repoOwner: owner,
    repoName: name,
    packageName,
  };
}

// ---------------------------------------------------------------------------
// Identity helpers
// ---------------------------------------------------------------------------

export function serviceAccountEmail(accountId: string, projectId: string): string {
  return `${accountId}@${projectId}.iam.gserviceaccount.com`;
}

export function serviceAccountExists(email: string, projectId: string): boolean {
  const result = gcloud(['iam', 'service-accounts', 'describe', email, `--project=${projectId}`], {
    capture: true,
    allowFail: true,
  });
  return result.status === 0;
}

function poolExists(poolId: string, projectId: string): boolean {
  const result = gcloud(
    [
      'iam',
      'workload-identity-pools',
      'describe',
      poolId,
      '--location=global',
      `--project=${projectId}`,
    ],
    { capture: true, allowFail: true },
  );
  return result.status === 0;
}

function providerExists(providerId: string, poolId: string, projectId: string): boolean {
  const result = gcloud(
    [
      'iam',
      'workload-identity-pools',
      'providers',
      'describe',
      providerId,
      `--workload-identity-pool=${poolId}`,
      '--location=global',
      `--project=${projectId}`,
    ],
    { capture: true, allowFail: true },
  );
  return result.status === 0;
}

// ---------------------------------------------------------------------------
// Idempotent provisioning helpers
// ---------------------------------------------------------------------------

export function ensureWorkloadIdentityPool(poolId: string, projectId: string): void {
  if (!DRY_RUN && poolExists(poolId, projectId)) {
    log(`Workload identity pool already exists: ${poolId}`);
    return;
  }
  gcloud([
    'iam',
    'workload-identity-pools',
    'create',
    poolId,
    '--location=global',
    '--description=The pool to authenticate GitHub actions.',
    '--display-name=Github Action for Pool',
    `--project=${projectId}`,
  ]);
  log(`Created workload identity pool: ${poolId}`);
}

export function ensureWorkloadIdentityProvider(options: {
  providerId: string;
  poolId: string;
  projectId: string;
  repoOwner: string;
}): void {
  const { providerId, poolId, projectId, repoOwner } = options;
  if (!DRY_RUN && providerExists(providerId, poolId, projectId)) {
    log(`Workload identity provider already exists: ${providerId}`);
    return;
  }
  gcloud([
    'iam',
    'workload-identity-pools',
    'providers',
    'create-oidc',
    providerId,
    `--workload-identity-pool=${poolId}`,
    '--issuer-uri=https://token.actions.githubusercontent.com/',
    "--attribute-mapping=google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner,attribute.branch=assertion.sub.extract('/heads/{branch}/')",
    '--location=global',
    `--attribute-condition=assertion.repository_owner=='${repoOwner}'`,
    '--display-name=Github Action for Pool Provider',
    `--project=${projectId}`,
  ]);
  log(`Created workload identity provider: ${providerId}`);
}

export function ensureServiceAccount(options: {
  accountId: string;
  projectId: string;
  displayName: string;
  description: string;
}): void {
  const { accountId, projectId, displayName, description } = options;
  const email = serviceAccountEmail(accountId, projectId);
  if (!DRY_RUN && serviceAccountExists(email, projectId)) {
    log(`Service account already exists: ${accountId}`);
    return;
  }
  gcloud([
    'iam',
    'service-accounts',
    'create',
    accountId,
    `--display-name=${displayName}`,
    `--description=${description}`,
    `--project=${projectId}`,
  ]);
  log(`Created service account: ${accountId}`);
}

/** Bind a project-level IAM role to a member. `add-iam-policy-binding` is idempotent. */
export function bindProjectRole(projectId: string, member: string, role: string): void {
  gcloud(['projects', 'add-iam-policy-binding', projectId, `--member=${member}`, `--role=${role}`]);
}

/** Bind a role on a service account resource (e.g. workloadIdentityUser). */
export function bindServiceAccountRole(options: {
  saEmail: string;
  projectId: string;
  role: string;
  member: string;
}): void {
  gcloud([
    'iam',
    'service-accounts',
    'add-iam-policy-binding',
    options.saEmail,
    `--project=${options.projectId}`,
    `--role=${options.role}`,
    `--member=${options.member}`,
  ]);
}

export function enableService(service: string, projectId: string): void {
  gcloud(['services', 'enable', service, `--project=${projectId}`]);
  log(`Enabled ${service}`);
}
