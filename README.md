# GroundQ

GroundQ is a role-neutral platform for generating configurable, higher-order questions grounded in user-provided study resources.

## V1 architecture

- React, TypeScript, Vite, Tailwind CSS, and shadcn/ui preparation
- Node.js, TypeScript, and Express modular monolith
- Shared Zod contracts in `packages/contracts`
- Supabase PostgreSQL, Auth, Storage, and pgvector
- Local Ollama inference and embeddings
- pnpm workspaces

The current repository contains infrastructure only. Product workflows, database tables, ingestion, retrieval, generation, and validation are intentionally deferred.

## Setup

```bash
corepack enable
pnpm install
copy .env.example .env
```

Fill in local configuration as needed. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the web application.

The Stitch MCP integration reads `STITCH_API_KEY` from the local `.env` file through `.vscode/mcp.json`. Keep the real value only in `.env`; commit only `.env.example` and the key-free MCP configuration.

## Run locally

```bash
pnpm dev
```

The web scaffold runs on `http://localhost:5173`; the API runs on `http://localhost:3001`. The health endpoint is `GET /api/v1/health`.

Supabase CLI configuration is under `supabase/`. Future database work should use versioned migrations and the CLI's local development commands.

## Verification

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## Documentation

The specifications and implementation history are in `docs/`. Start with `docs/index.md`; read `docs/LOG.md` before making changes.
