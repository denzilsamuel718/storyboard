# StoryBoard Creator Submission Platform

A production-oriented creator submission and review platform with an editorial, library-inspired interface. Creators can register, build a submission in five guided steps, upload private files directly to S3-compatible storage, receive an immutable public ID, and follow review status. Administrators get a separate secured review desk for creators, submissions, files, decisions, messages, private notes, and audit history.

## Architecture

- `apps/web` — Next.js 15 + TypeScript frontend (Vercel)
- `apps/api` — Express + TypeScript API (Render)
- `apps/api/prisma` — PostgreSQL schema and seed
- `packages/shared` — submission constants, labels, and upload policy
- Private AWS S3 / Cloudflare R2-compatible object storage

Large files use multipart uploads signed by the API but transferred directly from the browser to object storage. The Render service never accepts the video body.

## Local setup

Requirements: Node 20+ and pnpm 11.19+. PostgreSQL and S3 are not required for local testing.

1. Install dependencies if needed, then start the complete local platform:

```bash
corepack enable
pnpm install
pnpm dev
```

The command creates an embedded SQLite database, seeds the local administrator, starts private local file storage, and runs both applications. You may copy `.env.example` to `.env` to override the defaults, but it is not required.

Web: `http://localhost:3000` by default (the current audited session is running on `http://localhost:3100`) · API: `http://localhost:4000` · health: `http://localhost:4000/health`.

Local admin: `admin@example.com` / `ChangeMe123!`. Change these values before exposing any environment publicly.

## Checks

Run `pnpm typecheck`, `pnpm test`, and `pnpm build`.

The platform includes production-facing terms, but they should still be reviewed by qualified counsel before a public launch. Email verification and reset tokens are persisted securely; development returns the token for testing. Configure the included Resend integration before launch if transactional email is required.
