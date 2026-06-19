const path = require("path");

const webPath = path.resolve(__dirname, "apps/web");

const ciWebPath = path.resolve(__dirname, "out/apps/web");

module.exports = {
  scripts: {
    link: `node scripts/link-agent-skills.mjs`,
    prepare: {
      default: `nps prepare.web`,
      web: `pnpm install`,
      ci: {
        web: `npx turbo prune --scope=web && cd out && pnpm install --frozen-lockfile`,
      },
    },
    setup: {
      default: `nps setup.google`,
      google: {
        default: `nps setup.google.cloud && nps setup.google.cloudrun`,
        cloud: `node scripts/setup/google/cloud.mts`,
        cloudrun: `node scripts/setup/google/cloudrun.mts`,
      },
    },
    lint: {
      default: `npx turbo run lint`,
      web: `npx turbo run lint --filter=web`,
      packages: {
        default: `npx turbo run lint --filter=@workspace/ui --filter=@workspace/constants --filter=@workspace/types`,
        ui: `npx turbo run lint --filter=@workspace/ui`,
        constants: `npx turbo run lint --filter=@workspace/constants`,
        types: `npx turbo run lint --filter=@workspace/types`,
      },
    },
    format: {
      default: `npx turbo run format`,
      web: `npx turbo run format --filter=web`,
      packages: {
        default: `npx turbo run format --filter=@workspace/ui --filter=@workspace/constants --filter=@workspace/types`,
        ui: `npx turbo run format --filter=@workspace/ui`,
        constants: `npx turbo run format --filter=@workspace/constants`,
        types: `npx turbo run format --filter=@workspace/types`,
      },
    },
    typecheck: {
      default: `npx turbo run typecheck`,
      web: `npx turbo run typecheck --filter=web`,
      packages: {
        default: `npx turbo run typecheck --filter=@workspace/ui --filter=@workspace/constants --filter=@workspace/types`,
        ui: `npx turbo run typecheck --filter=@workspace/ui`,
        constants: `npx turbo run typecheck --filter=@workspace/constants`,
        types: `npx turbo run typecheck --filter=@workspace/types`,
      },
    },
    test: {
      default: `nps test.web`,
      web: `cd ${webPath} && pnpm test`,
      ci: {
        default: `nps test.ci.web`,
        web: `cd ${ciWebPath} && pnpm test:ci`,
      },
      watch: {
        default: `nps test.watch.web`,
        web: `cd ${webPath} && pnpm test:watch`,
      },
    },
    build: {
      default: "npx turbo run build",
      web: "npx turbo run build --filter=web",
      packages: {
        default: `npx turbo run build --filter=@workspace/constants --filter=@workspace/types`,
        constants: `npx turbo run build --filter=@workspace/constants`,
        types: `npx turbo run build --filter=@workspace/types`,
      },
      ci: {
        web: "cd out && pnpm build",
      },
    },
    docker: {
      build: {
        default: "nps docker.build.web",
        web: `docker build -t web . -f ${webPath}/Dockerfile`,
      },
      start: {
        web: "docker compose -f docker-compose.web.yml up --build",
      },
    },
    start: {
      default: `npx turbo run start`,
      web: "npx turbo run start --filter=web",
    },
    dev: {
      default: "npx turbo run dev",
      web: "npx turbo run dev --filter=web",
    },
  },
};
