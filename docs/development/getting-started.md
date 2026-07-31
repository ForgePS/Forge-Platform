# Getting Started

1. Install Node 20+ and enable Corepack: `corepack enable`
2. `corepack prepare pnpm@10.12.1 --activate`
3. `pnpm install`
4. Copy `.env.local.example` to `.env.local`
5. Start Postgres: `pnpm db:up`
6. Migrate: `pnpm db:migrate`
7. Run apps: `pnpm --filter @forge/platform-api dev` (and web apps as needed)

Never use real personnel data locally.
