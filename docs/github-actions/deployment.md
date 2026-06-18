# Deployment Workflow

**Files**: `.github/workflows/deployment.yml` and
`.github/workflows/deployment-common.yml`

## Prerequisites

- Google Cloud project with necessary permissions
- Workload Identity Federation configured (via `setup-google-cloud.sh`)
- GitHub repository secrets and variables configured (see
  [Configuration](#configuration))
- Docker configured in app directories (`apps/**/Dockerfile`)
- Service configuration files (`apps/**/service.yaml`)

## How It Works

The deployment workflow provides a two-stage deployment process to Google Cloud
Run:

### Trigger

| Trigger Type | When                              | Who                               |
| ------------ | --------------------------------- | --------------------------------- |
| **Manual**   | `workflow_dispatch` via GitHub UI | Repository maintainers/developers |

The workflow requires explicit input of deployment targets and environment.

## Workflow Inputs

Both inputs are **required** for workflow dispatch:

| Input         | Type        | Values                                      | Description                                             |
| ------------- | ----------- | ------------------------------------------- | ------------------------------------------------------- |
| `targets`     | string      | Comma-separated app names (e.g., `web,api`) | Apps to deploy from `apps/**/package.json` `name` field |
| `environment` | environment | `production` or `development`               | Deployment target environment                           |

### Example Input

```
targets: web
environment: production
```

## Configuration

### Required GitHub Secrets

Store these in **Settings > Secrets and variables > Secrets**:

| Secret                              | Description                              | Example                                      |
| ----------------------------------- | ---------------------------------------- | -------------------------------------------- |
| `GOOGLE_CLOUD_PROJECT_ID`           | Google Cloud project ID                  | `my-project-12345`                           |
| `GOOGLE_CLOUD_PROJECT_NUMBER`       | Google Cloud project number              | `123456789012`                               |
| `GOOGLE_CLOUD_IDENTITY_POOL_ID`     | Workload Identity Federation pool ID     | `projects/123456789012/locations/global/...` |
| `GOOGLE_CLOUD_IDENTITY_PROVIDER_ID` | Workload Identity Federation provider ID | `github-provider`                            |
| `UPSTASH_REDIS_REST_URL`            | Redis REST endpoint (for web app)        | `https://....upstash.io`                     |
| `UPSTASH_REDIS_REST_TOKEN`          | Redis authentication token               | `AX...`                                      |

### Required GitHub Variables

Store these in **Settings > Secrets and variables > Variables**:

| Variable              | Description                         | Example       |
| --------------------- | ----------------------------------- | ------------- |
| `GOOGLE_CLOUD_REGION` | Google Cloud region for deployment  | `us-central1` |
| `DOMAIN` (optional)   | Custom domain for Cloud Run service | `example.com` |

## Validation Logic

### Environment Validation

- **Requirement**: `environment` must not be empty
- **Production Restriction**: `production` can only be deployed from `main`
  branch
  - Attempting to deploy production from any other branch will fail with error
    message

### Targets Validation

- **Format**: Comma-separated app names with alphanumeric characters only
- **Valid Names**: Must match `name` field in `apps/**/package.json`
- **Parsing**: Spaces around commas are trimmed automatically
- **Error Handling**: Invalid app names or format cause workflow to fail with
  clear error message

## Job Structure

### 1. `get-details` Job

**Purpose**: Retrieve project and application metadata

- Discovers all apps from `apps/**/package.json`
- Extracts repository information
- Normalizes branch names for use in service identifiers

**Output**:

- `project_name`: Project name from root `package.json`
- `apps`: Array of app objects with name, version, and file path
- `apps_by_name`: Object indexed by app name for quick lookup
- `repository`: Repository metadata (name, owner, normalized ref)

### 2. `validate` Job

**Purpose**: Validate inputs and generate deployment matrix

**Validation Steps**:

1. Check `environment` is not empty
2. Verify `production` deployments only occur on `main` branch
3. Validate `targets` format (alphanumeric and commas only)
4. Check each target matches valid app names
5. Generate JSON array of validated targets for matrix

**Output**:

- `targets`: JSON array of validated app names for matrix strategy

**Failure Conditions**:

- Empty `environment` input
- `production` environment on non-`main` branch
- Invalid characters in `targets`
- `targets` contains unknown app names

### 3. `deploy-cloudrun` Job

**Purpose**: Deploy each app to Google Cloud Run

**Type**: Matrix job (runs once per validated target)

**Matrix Variable**: `target` (iterates through validated app names)

**Permissions**:

- `id-token: write` - Required for Workload Identity Federation
- `contents: read` - For repository access

**Conditions**:

- Runs only if both `get-details` and `validate` succeed
- Uses `always()` to check all prerequisite jobs

**Calls**: `./.github/workflows/deployment-common.yml` with:

- `project_name` - Project identifier
- `environment` - Target environment
- `app_name` - Current matrix target
- `app_version` - Normalized version (dots → hyphens)
- `repo_name` - Normalized repository name
- `ref_name` - Normalized branch/ref name

## Deployment Process (Common Workflow)

The `deployment-common.yml` reusable workflow handles the actual deployment.

### Step 1: Google Cloud Authentication

- Uses Workload Identity Federation for keyless authentication
- Generates temporary access token
- Token is scoped to the project service account

**Service Account Format**:
`{project_name}-github-sa@{project_id}.iam.gserviceaccount.com`

### Step 2: Create Artifact Repository

- Checks if Docker Artifact Repository exists
- Creates repository if missing
- Uses repository name from normalized `repo_name`
- Location: Region specified in `GOOGLE_CLOUD_REGION` variable

### Step 3: Docker Authentication

- Logs in to Artifact Registry using access token
- Uses `oauth2accesstoken` as username
- Registry: `{region}-docker.pkg.dev`

### Step 4: Build and Push Docker Image

**Image Naming**:

```
{region}-docker.pkg.dev/{project_id}/{repo_name}/{app_name}/{environment}:{tag}
```

**Tags Applied**:

- `{app_version}` - Version from app's package.json (normalized: dots → hyphens)
- `{github.sha}` - Current commit SHA
- `latest` - Latest tag

**Build Configuration**:

- **Dockerfile**: `./apps/{app_name}/Dockerfile`
- **Platforms**: `linux/amd64`
- **Cache**: Uses GitHub Actions cache scoped to `{app_name}-{ref_name}`

### Step 5: Generate Service Configuration

**Source**: `./apps/{app_name}/service.yaml`

**Environment Variables Substituted**:

| Variable                      | Source                                                  | Example                      |
| ----------------------------- | ------------------------------------------------------- | ---------------------------- |
| `APP_NAME`                    | Input parameter                                         | `web`                        |
| `ENVIRONMENT`                 | Input parameter                                         | `production`                 |
| `PROJECT_NAME`                | Input parameter                                         | `turborepo-starter`          |
| `GOOGLE_CLOUD_PROJECT_ID`     | Secret                                                  | `my-project-12345`           |
| `SERVICE_ACCOUNT`             | Derived per app (web: `{project_name}-cloudrun-sa@...`) | `...`                        |
| `BASE_URL`                    | Generated from domain/project info                      | `https://example.com`        |
| `LOG_FORMAT`                  | Static                                                  | `json`                       |
| `GITHUB_SHA`                  | Git context                                             | `abc123...`                  |
| `CONTAINER_IMAGE`             | Generated from Docker build                             | `region-docker.pkg.dev/.../` |
| `CLOUD_RUN_SERVICE_NAME`      | Generated from inputs                                   | `turborepo-starter-web-prod` |
| `GOOGLE_CLOUD_PROJECT_NUMBER` | Secret                                                  | `123456789012`               |

**Output**: `service-{environment}.yaml`

### Step 6: Prepare and Upsert Secrets

**Per-App Secrets** (conditionally):

- **Web app**:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`

**Process**:

1. Check if secret exists in Google Cloud Secret Manager
2. If not, create new secret with replication policy `automatic`
3. If exists and value unchanged, skip
4. If exists and value changed, add new version

### Step 7: Deploy to Cloud Run

**Action**: `google-github-actions/deploy-cloudrun@v2`

**Configuration**:

- **Service Name**: `{project_name}-{app_name}-{environment}`
- **Region**: From `GOOGLE_CLOUD_REGION` variable
- **Metadata File**: `service-{environment}.yaml`
- **Project**: From secret `GOOGLE_CLOUD_PROJECT_ID`

**Timeout**: 5 minutes

## URL Generation Logic

### Base URL by Environment

#### Production

```
https://{DOMAIN}
```

Or if domain not configured:

```
https://{project_name}-{app_name}-{environment}-{project_number}.{region}.run.app
```

#### Development

```
https://dev.{DOMAIN}
```

Or if domain not configured:

```
https://{project_name}-web-{environment}-{project_number}.{region}.run.app
```

> **Note**: Ensure DNS records are configured in Cloudflare or your DNS provider
> to point to Cloud Run services. See [Mapping Domain](../mapping-domain.md) for
> domain configuration steps.

## Service Configuration

The `service.yaml` template uses environment variable substitution:

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: ${CLOUD_RUN_SERVICE_NAME}
spec:
  template:
    spec:
      serviceAccountName: ${SERVICE_ACCOUNT}
      containers:
        - image: ${CONTAINER_IMAGE}
          env:
            - name: BASE_URL
              value: "${BASE_URL}"
            - name: ENVIRONMENT
              value: "${ENVIRONMENT}"
            # Additional environment variables...
```

For detailed service configuration, see `apps/{app_name}/service.yaml`.

## Docker Build Cache

The workflow uses GitHub Actions cache to speed up Docker builds:

**Cache Key**: `{app_name}-{ref_name}`

**Cache Scope**: Tied to branch-specific builds

- Different branches maintain separate caches
- Cache survives across workflow runs on the same branch

## Deployment Matrix Example

If you specify `targets: web,api` for production deployment:

The workflow will:

1. Validate both `web` and `api` are valid app names
2. Create matrix with `[web, api]`
3. Run `deploy-cloudrun` job **twice**:
   - Once with `matrix.target = web`
   - Once with `matrix.target = api`
4. Each deployment is independent and parallelized

## Environment-Specific Behavior

### Production Deployment

- **Branch Requirement**: Must be on `main` branch
- **Service Name**: `{project_name}-{app_name}-production`
- **URL**: Custom domain if configured, else default Cloud Run URL
- **Implications**: Production secrets and configurations are used

### Development Deployment

- **Branch Requirement**: Can deploy from any branch
- **Service Name**: `{project_name}-{app_name}-development`
- **URL**: `dev.` subdomain if custom domain configured
- **Implications**: Development secrets and configurations are used

## Troubleshooting

### Validation Fails: "environment must specify production or development"

**Cause**: `environment` input is empty

**Solution**: Provide either `production` or `development` as environment input

### Validation Fails: "production can only be specified for the main branch"

**Cause**: Attempting production deployment from a non-`main` branch

**Solution**: Either:

- Deploy only from `main` branch for production
- Use `development` environment for non-main branches

### Validation Fails: "target is an invalid value"

**Cause**: App name doesn't match any `name` in `apps/**/package.json`

**Solution**:

1. Check spelling of app name matches exactly (case-sensitive)
2. Verify app's `package.json` has a `name` field
3. Use `Display Details` workflow to see valid app names

### Docker Build Fails

**Cause**: Missing Dockerfile or invalid Docker configuration

**Solution**:

1. Verify `apps/{app_name}/Dockerfile` exists
2. Check Dockerfile syntax is valid
3. Ensure all build dependencies are available
4. Check Docker build context and paths

### Cloud Run Deployment Fails: "service account does not have required permissions"

**Cause**: Service account missing necessary IAM roles

**Solution**:

1. Re-run setup script: `./scripts/setup-google-cloud.sh`
2. Verify IAM roles were applied correctly in Google Cloud Console
3. Check service account email in error matches configured service account

### Deployment Succeeds but Service Unreachable

**Cause**: Network or domain configuration issue

**Solution**:

1. Check Cloud Run service URL directly (from Google Cloud Console)
2. If using custom domain, verify DNS records are configured
3. See [Mapping Domain](../mapping-domain.md) for domain setup
4. Check Cloud Run service ingress settings (should allow `all`)

### Secret Manager Fails: "secret already exists"

**Cause**: Secret name conflict with existing secret

**Solution**:

- The workflow handles this gracefully by checking if values match
- If value matches, secret is skipped
- If value differs, a new version is added
- Check workflow logs for detailed secret update status

### Dockerfile Build Hangs or Times Out

**Cause**: Build process exceeds timeout or waits for input

**Solution**:

1. Verify no interactive steps in Dockerfile
2. Check for long-running operations (install, build)
3. Optimize Dockerfile for faster builds
4. Consider using multi-stage builds

## Security Considerations

- **Workload Identity Federation**: Keyless authentication - no long-lived
  credentials in repository
- **Secrets**: Stored securely in GitHub and Google Cloud Secret Manager
- **Access Control**: Service account permissions scoped to deployment service
  only
- **Audit Trail**: All deployments logged in GitHub Actions and Google Cloud
  Audit Logs
- **Branch Protection**: Production deployments restricted to `main` branch

## Related Documentation

- [Cleanup Build Cache](./cleanup-build-cache.md) - Managing Docker build caches
- [Mapping Domain](../mapping-domain.md) - Custom domain configuration
- [Setup Script](../scripts/setup-google-cloud.sh) - Google Cloud resource
  initialization
