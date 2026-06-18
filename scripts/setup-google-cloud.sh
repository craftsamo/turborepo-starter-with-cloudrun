#!/bin/bash

###############################################################################
#  Create Log file                                                            #
###############################################################################

LOG_FILE="scripts/log/setup-google-cloud.log"
mkdir -p scripts/log && >"$LOG_FILE"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

exec 2> >(while read -r line; do log "ERROR: $line"; done)

###############################################################################
# Check if required values are set                                            #
###############################################################################

# Load environment variables from .env file if it exists
if [ -f .env ]; then
  set -a
  source .env
  set +a
  log "Loaded environment variables from .env file."
fi

if [ -z "$GOOGLE_CLOUD_PROJECT_ID" ]; then
  log "Please set GOOGLE_CLOUD_PROJECT_ID."
  exit 1
fi

if [ -z "$GOOGLE_CLOUD_PROJECT_NUMBER" ]; then
  log "Please set GOOGLE_CLOUD_PROJECT_NUMBER."
  exit 1
fi

if [ -z "$GOOGLE_CLOUD_IDENTITY_POOL_ID" ]; then
  log "Please set GOOGLE_CLOUD_IDENTITY_POOL_ID."
  exit 1
fi

if [ -z "$GOOGLE_CLOUD_IDENTITY_PROVIDER_ID" ]; then
  log "Please set GOOGLE_CLOUD_IDENTITY_PROVIDER_ID."
  exit 1
fi

###############################################################################
# Get Project infomation                                                      #
###############################################################################

# Get repository URL from git config
REPO_URL=$(git config --get remote.origin.url)
log "Repository URL: $REPO_URL"

# Extract repository owner from URL
REPO_OWNER=$(echo "$REPO_URL" | sed -n 's#.*[:/]\([^/]*\)/[^/]*\.git#\1#p')
if [ -z "$REPO_OWNER" ]; then
  log "Error: Unable to extract repository owner name from the URL."
  exit 1
fi
log "Repository owner: $REPO_OWNER"

# Extract repository name from URL
REPO_NAME=$(echo "$REPO_URL" | sed -n 's#.*[:/][^/]*/\([^/]*\)\.git#\1#p')
if [ -z "$REPO_NAME" ]; then
  log "Error: Unable to extract repository name from the URL."
  exit 1
fi
log "Repository name: $REPO_NAME"

# Extract package name from package.json
PACKAGE_NAME=$(jq -r '.name' package.json)
if [ -z "$PACKAGE_NAME" ]; then
  log "Error: Could not extract name from package.json."
  exit 1
fi
log "Package name: $PACKAGE_NAME"

###############################################################################
# Setup workload identity pools                                               #
###############################################################################

# Create workload identity pool
gcloud iam workload-identity-pools create "$GOOGLE_CLOUD_IDENTITY_POOL_ID" \
  --location="global" \
  --description="The pool to authenticate GitHub actions." \
  --display-name="Github Action for Pool" \
  --project="$GOOGLE_CLOUD_PROJECT_ID"
log "Created workload identity pool: $GOOGLE_CLOUD_IDENTITY_POOL_ID"

# Create workload identity provider
gcloud iam workload-identity-pools providers create-oidc "$GOOGLE_CLOUD_IDENTITY_PROVIDER_ID" \
  --workload-identity-pool="$GOOGLE_CLOUD_IDENTITY_POOL_ID" \
  --issuer-uri="https://token.actions.githubusercontent.com/" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner,attribute.branch=assertion.sub.extract('/heads/{branch}/')" \
  --location="global" \
  --attribute-condition="assertion.repository_owner=='$REPO_OWNER'" \
  --display-name="Github Action for Pool Provider" \
  --project="$GOOGLE_CLOUD_PROJECT_ID"
log "Created workload identity provider: $GOOGLE_CLOUD_IDENTITY_PROVIDER_ID"

###############################################################################
# Setup service account
###############################################################################

# Create "Github Workflows" service account
gcloud iam service-accounts create "$PACKAGE_NAME-github-sa" \
  --display-name="Github Workflows Account" \
  --description="Manages GitHub Actions authentication and deployment access" \
  --project="$GOOGLE_CLOUD_PROJECT_ID"
log "Created Github Workflow service account: $PACKAGE_NAME-github-sa"

# Create "Cloud Run" service account
gcloud iam service-accounts create "$PACKAGE_NAME-cloudrun-sa" \
  --display-name="Cloud Run Service Account" \
  --description="Manages Cloud Run runtime permissions" \
  --project="$GOOGLE_CLOUD_PROJECT_ID"
log "Created Cloud Run service account: $PACKAGE_NAME-cloudrun-sa"

###############################################################################
#  Binding IAM polycy for service account                                     #
###############################################################################

# Define role sets per service account
github_roles=(
  "roles/artifactregistry.admin"         ## Read,Create,Update Artifactregistry
  "roles/run.admin"                      ## Create,Update Cloud Run
  "roles/iam.serviceAccountUser"         ## Authorize the use of service accounts on behalf of others
  "roles/iam.serviceAccountTokenCreator" ## Create, Service Account Tokens
  "roles/secretmanager.admin"            ## Create,Update SecretManager
)

cloudrun_roles=(
  "roles/logging.logWriter"
  "roles/monitoring.metricWriter"
  "roles/run.admin"                    ## Excute Cloud Run
  "roles/secretmanager.secretAccessor" ## Runtime read access to Secret Manager
)

# Bind roles to GitHub workflows service account
for role in "${github_roles[@]}"; do
  gcloud projects add-iam-policy-binding "${GOOGLE_CLOUD_PROJECT_ID}" \
    --member="serviceAccount:$PACKAGE_NAME-github-sa@$GOOGLE_CLOUD_PROJECT_ID.iam.gserviceaccount.com" \
    --role="$role"
done
log "Added IAM policy bindings for GitHub workflows service account."

# Bind roles to Cloud Run service account
for role in "${cloudrun_roles[@]}"; do
  gcloud projects add-iam-policy-binding "${GOOGLE_CLOUD_PROJECT_ID}" \
    --member="serviceAccount:$PACKAGE_NAME-cloudrun-sa@$GOOGLE_CLOUD_PROJECT_ID.iam.gserviceaccount.com" \
    --role="$role"
done
log "Added IAM policy bindings for Cloud Run service account."

# Add workload identity binding for Cloud Run service account (allow pool members to impersonate)
gcloud iam service-accounts add-iam-policy-binding "$PACKAGE_NAME-cloudrun-sa@$GOOGLE_CLOUD_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$GOOGLE_CLOUD_PROJECT_NUMBER/locations/global/workloadIdentityPools/$GOOGLE_CLOUD_IDENTITY_POOL_ID/attribute.repository/$REPO_OWNER/$REPO_NAME" \
  --project="$GOOGLE_CLOUD_PROJECT_ID"
log "Added IAM policy binding for Cloud Run service account."

# Add workload identity bindings for GitHub workflows service account (main branch + repository)
gcloud iam service-accounts add-iam-policy-binding "$PACKAGE_NAME-github-sa@$GOOGLE_CLOUD_PROJECT_ID.iam.gserviceaccount.com" \
  --project="${GOOGLE_CLOUD_PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principal://iam.googleapis.com/projects/$GOOGLE_CLOUD_PROJECT_NUMBER/locations/global/workloadIdentityPools/$GOOGLE_CLOUD_IDENTITY_POOL_ID/subject/repo:$REPO_OWNER/application-repo:ref:refs/heads/main"
log "Added IAM policy binding for GitHub workflows service account (main branch)."

gcloud iam service-accounts add-iam-policy-binding "$PACKAGE_NAME-github-sa@$GOOGLE_CLOUD_PROJECT_ID.iam.gserviceaccount.com" \
  --project="${GOOGLE_CLOUD_PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$GOOGLE_CLOUD_PROJECT_NUMBER/locations/global/workloadIdentityPools/$GOOGLE_CLOUD_IDENTITY_POOL_ID/attribute.repository/$REPO_OWNER/$REPO_NAME"
log "Added IAM policy binding for GitHub workflows service account (repository)."

###############################################################################
# Enable require services                                                     #
###############################################################################

services=(
  "iamcredentials.googleapis.com"   ## Google Auth
  "artifactregistry.googleapis.com" ## Artifact repository
  "run.googleapis.com"              ## Cloud run
  "secretmanager.googleapis.com"    ## Secret Manager
)

for service in "${services[@]}"; do
  gcloud services enable "$service" --project="$GOOGLE_CLOUD_PROJECT_ID"
  echo "Enabled $service"
done
