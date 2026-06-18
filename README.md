# Welcome to the Turborepo Starter with Cloud Run!

This project serves as a boilerplate for efficiently developing applications
using Turborepo, equipped with various best practices and carefully selected
configurations. It extends the [Turborepo Starter](https://github.com/craftsamo/turborepo-starter)
with a Google Cloud Run deployment pipeline, so you can go from clone to a
deployed web service without wiring up the infrastructure yourself.

## 📖 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Set Environment Variables](#-set-environment-variables)
- [Available Commands](#-available-commands)
- [GitHub Actions Workflows](#-github-actions-workflows)

## ✨ Features

- **Monorepo Setup**: Turborepo with pnpm workspaces for scalable project
  organization
- **TypeScript**: Strict type checking with TypeScript 5+
- **Next.js Integration**: Ready-to-use web app with App Router
- **Component Library**: Shared UI components built with Shadcn/ui and Tailwind
  CSS
- **Code Quality**: ESLint, Prettier, and Husky for consistent code standards
- **Testing**: Vitest setup for unit and integration tests
- **Git Workflow**: Commitizen and Commitlint for conventional commits
- **AI Agent Skills**: on-demand skills in `.opencode/skills/`, shared across
  Claude Code, Codex, Gemini CLI, and Copilot. Tool-native skill links
  (`.agents/skills/`, `.claude/skills/`) are generated on `pnpm install`
  (POSIX symlink / Windows junction, no admin needed); per-package `AGENTS.md`
  is auto-loaded as instructions
- **Cloud Run Deployment**: Google Cloud Run deployment pipeline with Workload
  Identity Federation, Artifact Registry, and Secret Manager
- **Best Practices**: Optimized configurations and development guidelines

## 🛠 Tech Stack

- **Monorepo**: [Turborepo](https://turbo.build) with pnpm Workspaces
- **Runtime**: Node.js 24+
- **Language**: TypeScript 5+
- **Framework**: [Next.js 16](https://nextjs.org) (App Router) + [React 19](https://react.dev)
- **UI Library**: React with Shadcn/ui components
- **State**: Redux Toolkit + react-redux
- **Theming**: next-themes
- **Toasts**: sonner (via `@workspace/ui`)
- **Styling**: Tailwind CSS and PostCSS
- **Testing**: Vitest
- **Code Quality**: ESLint, Prettier
- **Git Hooks**: Husky with conventional commits
- **Deployment**: Google Cloud Run with Artifact Registry and Secret Manager

## 📁 Project Structure

```
turborepo-starter-with-cloudrun/
├── apps/
│   └── web/               # Next.js web application
├── packages/
│   ├── constants/         # Shared constants and error codes
│   ├── eslint/            # Shared ESLint configurations
│   ├── prettier/          # Shared Prettier configuration
│   ├── tsconfig/          # TypeScript configurations
│   ├── types/             # Shared TypeScript types
│   ├── ui/                # Shared UI components (Shadcn/ui)
│   └── vitest/            # Shared Vitest configuration
├── scripts/
│   └── setup-google-cloud.sh  # Google Cloud resource initialization
├── docs/
│   ├── github-actions/    # GitHub Actions workflow documentation
│   ├── instructions/      # AI-agent guidelines (GENERAL/ISSUE/TASK/REVIEW)
│   └── mapping-domain.md  # Custom domain mapping guide
├── .opencode/             # opencode skills and agent config
├── .github/               # GitHub Actions workflows
└── .husky/                # Git hooks configuration
```

## 🚀 Getting Started

### Prerequisites

- Node.js 24.0 or higher
- pnpm 11.5.3 or higher (via Corepack)

### Installation

1. **Clone the repository**

```sh
git clone https://github.com/craftsamo/turborepo-starter-with-cloudrun.git
cd turborepo-starter-with-cloudrun
```

2. **Install Dependencies**

```sh
corepack enable
pnpm install
pnpm add -g nps
```

3. **Configure local environment**

Copy the example env files and fill in the values you need for local
development:

```sh
cp apps/web/.env.example apps/web/.env   # web app (LOG_FORMAT, BASE_URL, Upstash Redis, ...)
```

> The root `.env.example` is used by `scripts/setup-google-cloud.sh` for Google
> Cloud provisioning and is not required for local development.

4. **Run Development Server**

```sh
nps dev
```

## ⚙️ Set Environment Variables

### Local Development

The web app reads runtime configuration from `apps/web/.env`. See
`apps/web/.env.example` for the full list:

| Variable                   | Purpose                                      |
| -------------------------- | -------------------------------------------- |
| `BASE_URL`                 | Base URL used for absolute links, sitemap, robots, and API calls |
| `LOG_LEVEL`                | Logger verbosity: `verbose` / `debug` / `info` / `log` / `warn` / `error` / `fatal` (default: `info`) |
| `LOG_FORMAT`               | Logger format: `text` (local) or `json` (Cloud Run) |
| `UPSTASH_REDIS_REST_URL`   | Upstash Redis REST endpoint (used by the logger) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST auth token                |

### GitHub Actions Variables

Set the following variables in your GitHub repository settings under
**Settings > Secrets and variables > Variables**:

| Variable              | Default                    |
| --------------------- | -------------------------- |
| `AI_PROVIDER_ID`      | github-copilot             |
| `AI_MODEL_ID`         | gpt-5-mini                 |
| `AI_REVIEW_MODEL_ID`  | `AI_MODEL_ID` → gpt-5-mini |
| `AI_ISSUE_MODEL_ID`   | `AI_MODEL_ID` → gpt-5-mini |
| `AI_TASK_MODEL_ID`    | `AI_MODEL_ID` → gpt-5-mini |
| `GOOGLE_CLOUD_REGION` | ""                         |
| `DOMAIN` (optional)   | ""                         |

### GitHub Actions Secrets

For GitHub Copilot authentication, add the following secret under **Settings >
Secrets and variables > Secrets**:

| Secret                  | Default |
| ----------------------- | ------- |
| `COPILOT_ACCESS_TOKEN`  | ""      |
| `COPILOT_REFRESH_TOKEN` | ""      |

For Cloud Run deployment, add the following secrets:

| Secret                              | Default |
| ----------------------------------- | ------- |
| `GOOGLE_CLOUD_PROJECT_ID`           | ""      |
| `GOOGLE_CLOUD_PROJECT_NUMBER`       | ""      |
| `GOOGLE_CLOUD_IDENTITY_POOL_ID`     | ""      |
| `GOOGLE_CLOUD_IDENTITY_PROVIDER_ID` | ""      |
| `UPSTASH_REDIS_REST_URL`            | ""      |
| `UPSTASH_REDIS_REST_TOKEN`          | ""      |

For details on how to set up GitHub Copilot authentication, see
[Run AI Agent Workflow](docs/github-actions/run-ai-agent.md). For Cloud Run
setup, run `./scripts/setup-google-cloud.sh` after configuring the Google Cloud
secrets above (see [Deployment](docs/github-actions/deployment.md)).

## 📦 Available Commands

Commands are run with [`nps`](https://github.com/seblepouls/nps)
(npm-script-runner). See [package-scripts.js](package-scripts.js) for the full
list.

| Command              | Description                                  |
| -------------------- | -------------------------------------------- |
| `nps dev`            | Start the web dev server (Turborepo dev)     |
| `nps build`          | Build all apps and packages                  |
| `nps build.web`      | Build only the web app                       |
| `nps build.packages` | Build shared packages (constants, types)     |
| `nps lint`           | Lint all apps and packages                   |
| `nps lint.web`       | Lint only the web app                        |
| `nps format`         | Format all apps and packages                 |
| `nps typecheck`      | Type-check all apps and packages             |
| `nps test`           | Run web app tests                            |
| `nps test.watch`     | Run web app tests in watch mode              |
| `nps docker.build.web` | Build the web Docker image                  |
| `nps docker.start.web` | Start the web container via docker-compose  |
| `nps start`          | Start the built web app in production mode   |

> Single test file: `cd apps/web && pnpm test -- path/to/test.test.tsx`

## 🔄 GitHub Actions Workflows

This project includes automated workflows for code quality, testing, and release
management. Each workflow is triggered by specific events and helps maintain
project standards.

### Available Workflows

| Workflow            | Trigger                 | Purpose                                                                |
| ------------------- | ----------------------- | ---------------------------------------------------------------------- |
| **Assign Labels**   | PR opened               | Automatically assigns labels based on branch naming convention         |
| **Sync Labels**     | Manual dispatch         | Synchronizes repository labels with `.github/labels.yml` configuration |
| **Display Details** | Manual dispatch         | Displays project, apps, and repository information                     |
| **Cleanup Cache**   | Schedule/Manual         | Cleans up old GitHub Actions build caches                              |
| **Deployment**      | Manual dispatch         | Deploys apps to Google Cloud Run                                       |
| **Release Drafter** | Push/PR to main         | Creates and updates draft releases with categorized changes            |
| **Tests**           | Push/PR to main/develop | Runs tests for affected apps and packages                              |
| **Run AI Agent**    | Issue/PR comment        | Executes AI-powered code tasks via `/oc` or `/opencode` commands       |

### Documentation

For detailed information about each workflow, including prerequisites,
configuration, and usage, see:

- [assign-labels.md](docs/github-actions/assign-labels.md)
- [sync-labels.md](docs/github-actions/sync-labels.md)
- [display-details.md](docs/github-actions/display-details.md)
- [cleanup-build-cache.md](docs/github-actions/cleanup-build-cache.md)
- [deployment.md](docs/github-actions/deployment.md)
- [release-drafter.md](docs/github-actions/release-drafter.md)
- [tests.md](docs/github-actions/tests.md)
- [run-ai-agent.md](docs/github-actions/run-ai-agent.md)

For custom domain mapping to Cloud Run services, see
[Mapping Domain](docs/mapping-domain.md).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file
for details.
