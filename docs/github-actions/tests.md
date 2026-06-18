# Tests Workflow

**File**: `.github/workflows/tests.yml`

## Prerequisites

- Push to `main` or `develop` branches with changes in `apps/**` or
  `packages/**`
- Pull request against `main` or `develop` branches with changes in `apps/**` or
  `packages/**`
- Or manual trigger via GitHub Actions UI (`workflow_dispatch`)
- Node.js 20.x compatible environment
- pnpm package manager with lock file present

## How It Works

The workflow automatically runs tests for applications and packages when
relevant changes are detected. It uses path filtering to optimize test execution
by only running tests when specific directories change.

### Process

1. **Trigger**: Push/PR to `main`/`develop` or manual dispatch
2. **Filter**: Detect changes in `apps/**` and `packages/**` directories
3. **Setup**: Install Node.js 20.x, cache dependencies
4. **Prepare**: Prune monorepo and install dependencies (CI mode)
5. **Build**: Build the application
6. **Test**: Run test suite

### Job Structure

| Job     | Purpose                               | Conditions               |
| ------- | ------------------------------------- | ------------------------ |
| changes | Detect file changes in relevant paths | Always runs              |
| setup   | Install dependencies and cache them   | Runs if changes detected |
| test    | Build and test the application        | Runs if setup succeeds   |

### Change Detection

The workflow uses [dorny/paths-filter](https://github.com/dorny/paths-filter) to
detect changes:

| Target | Paths Monitored              |
| ------ | ---------------------------- |
| web    | `apps/web/**`, `packages/**` |

Tests only run for a target if changes are detected in its monitored paths.

### Commands Executed

For each affected application/package:

1. **Prepare (CI)**: `nps prepare.ci.{target}`
   - Prunes monorepo to specific scope
   - Installs dependencies with frozen lockfile

2. **Build (CI)**: `nps build.ci.{target}`
   - Builds the target application/package

3. **Test (CI)**: `nps test.ci.{target}`
   - Runs test suite for the target

### Caching Strategy

- **Cache Key**: `${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}`
- **Cache Path**: pnpm store directory from `pnpm store path`
- **Restore Keys**: Falls back to OS + pnpm prefix if exact match not found

This allows subsequent workflow runs to reuse cached dependencies when
`pnpm-lock.yaml` hasn't changed.
