# Cleanup Build Cache Workflow

**File**: `.github/workflows/cleanup-build-cache.yml`

## Prerequisites

- `actions: write` permission to manage GitHub Actions caches
- `contents: read` permission to access repository contents
- Optional: Specific app names to target for cleanup

## How It Works

The workflow automatically cleans up GitHub Actions build caches in two ways:

### Trigger Methods

| Trigger      | Schedule                         | When It Runs                          |
| ------------ | -------------------------------- | ------------------------------------- |
| **Schedule** | First day of every month 3 AM    | Automatic monthly cleanup             |
| **Manual**   | Any time via `workflow_dispatch` | On-demand cleanup with custom filters |

## Inputs

Available only for manual trigger (`workflow_dispatch`):

| Parameter      | Type   | Default | Description                                                                                      |
| -------------- | ------ | ------- | ------------------------------------------------------------------------------------------------ |
| `apps`         | string | ""      | Optional comma-separated app names (e.g., `web,api`). If omitted, discovers apps from repository |
| `max-age-days` | string | 30      | Delete caches older than this number of days. Ignored for scheduled runs (always uses 30 days)   |

### Example Inputs

```
apps: web,api
max-age-days: 14
```

## Process Overview

### For Scheduled Runs

1. **Trigger**: Automatically runs monthly (1st at 03:00 UTC)
2. **Fetch**: Retrieve all caches from repository
3. **Filter**: Delete caches older than 30 days (regardless of scope)
4. **Report**: Log deleted cache count

### For Manual Runs

1. **Trigger**: Manual dispatch from GitHub Actions UI
2. **Get Details**: Call reusable `get-details.yml` workflow to discover apps
3. **Build Scopes**: Create scope filter from apps and current branch
4. **Fetch**: Retrieve all caches from repository
5. **Normalize**: Convert branch names to match cache scope format (lowercase,
   `/` → `-`)
6. **Filter**: Delete matching caches based on:
   - Requested app-branch scopes
   - Caches from branches that no longer exist
   - Age filter (older than `max-age-days`)
7. **Report**: Log deleted cache count and details

### Job Structure

| Job              | Purpose                                  | Conditions             |
| ---------------- | ---------------------------------------- | ---------------------- |
| `get-details`    | Discover apps and repository information | Always runs            |
| `cleanup-caches` | Delete matching GHA caches               | Runs after get-details |

## Cache Deletion Logic

### Scheduled Run Behavior

- **Always**: Delete all caches older than 30 days
- **Ignores**: App filters and branch-specific matching
- **Scope**: Repository-wide cleanup

### Manual Run Behavior

Caches are deleted if they match **any** of these conditions:

1. **Scope Matching**: Cache scope contains requested app-branch filter
   - Example: For app `web` on branch `main`, delete caches with scope
     `web-main`

2. **Deleted Branch**: Cache scope references a branch that no longer exists
   - Example: If `feature/old-feature` branch was deleted, clean up caches like
     `web-feature-old-feature`

3. **Age Filter**: Cache was created more than `max-age-days` ago
   - Applied only if other conditions are met

### Branch Name Normalization

Cache scopes use normalized branch names:

- Lowercase: `Main` → `main`
- Slashes to hyphens: `release/v1.0` → `release-v1-0`

This normalization is applied to both input filters and cached scope names for
consistent matching.

## Key Features

### Automatic App Discovery

If no `apps` parameter is provided, the workflow:

1. Calls `get-details.yml` to discover all apps in `apps/**/package.json`
2. Builds scope filters automatically
3. Falls back gracefully if app discovery fails

### Branch Cleanup

The workflow automatically removes caches from deleted branches:

1. Fetches all active repository branches
2. Parses cache scope names (`app-branch` format)
3. Deletes caches where branch no longer exists

### Safe Deletion

- Validates cache timestamps before deletion
- Skips caches with missing/invalid creation dates
- Logs all deletion attempts with cache IDs and scopes
- Reports warnings for failed deletions

## Example Scenarios

### Scenario 1: Manual Cleanup for Specific App and Branch

**Input**:

```
apps: web
max-age-days: 7
```

**Result**:

- Delete `web-{current-branch}` caches older than 7 days
- Ignores caches from other apps

### Scenario 2: Cleanup After Branch Deletion

**Input**:

```
apps: web,api
max-age-days: 30
```

**Result**:

- Delete `web-{branch}` and `api-{branch}` caches older than 30 days from
  deleted branches
- Also delete caches matching current branch scope older than 30 days

### Scenario 3: Automatic Monthly Cleanup

**Trigger**: Scheduled (1st of month, 3 AM UTC)

**Result**:

- Delete all repository caches older than 30 days
- No app or branch filtering applied

## Data Flow

```
Manual Trigger
    ↓
Get Details (apps, repository info)
    ↓
Fetch All Caches
    ↓
Fetch Active Branches
    ↓
For each cache:
    ├─ Check age
    ├─ Check scope match (if manual)
    ├─ Check for deleted branch
    └─ Delete if conditions met
    ↓
Report Results
```

## Permissions and Security

- **Requires**: `actions: write` to delete caches
- **Requires**: `contents: read` to access branch information
- **Uses**: GitHub Script with authenticated `github` context
- **Scope**: Limited to calling repository only

## Troubleshooting

### No Caches Deleted

- Check if caches are older than `max-age-days`
- Verify app names match exactly (case-sensitive)
- Ensure branch name matches current branch
- Check for caches from deleted branches in logs

### Cache Deletion Fails

- The workflow logs warnings but continues
- Check GitHub Actions logs for specific cache IDs that failed
- May be due to concurrent cache access
- Retry the workflow if intermittent failures occur

### Unexpected Caches Deleted

- Review workflow logs to see which caches matched filters
- Check if branch name contains special characters (check normalization)
- Verify no caches from active branches were deleted
- For scheduled runs, deletion is repository-wide after 30 days
