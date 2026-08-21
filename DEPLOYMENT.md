# Deployment

## PostgreSQL

Create managed PostgreSQL and set its private connection string as `DATABASE_URL` on Render. Create and commit the initial migration locally with `pnpm --filter @storyboard/api exec prisma migrate dev --name init`. Production deploys use `pnpm --filter @storyboard/api prisma:migrate`. Enable provider backups.

## Private object storage

Create a private bucket in AWS S3, Cloudflare R2, or another S3-compatible provider. Set `S3_REGION`, `S3_ENDPOINT` (for R2), `S3_BUCKET`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY` on Render.

Allow browser CORS only from approved Vercel origins, with `PUT`, `GET`, and `HEAD`; expose `ETag`. Add a lifecycle rule to abort incomplete multipart uploads after 24 hours. Never make the bucket public.

## Render API

Use `render.yaml`, or create a Node service:

- Build: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @storyboard/api prisma:generate && pnpm --filter @storyboard/api build`
- Start: `pnpm --filter @storyboard/api prisma:migrate && pnpm --filter @storyboard/api prisma:seed && pnpm --filter @storyboard/api start`
- Health: `/health`

The Blueprint sets `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, and the production `FRONTEND_URL`. Set the storage variables before enabling uploads. `ADMIN_EMAIL` and `ADMIN_PASSWORD` are optional as a pair; when both are set, startup creates or updates the administrator. Production rejects partial credentials and the local default password. For transactional email, also set `RESEND_API_KEY` and `EMAIL_FROM`.

If more than one frontend origin is needed, provide a comma-separated `FRONTEND_URL` list. The first origin is used for links in transactional email.

## Vercel frontend

Import the repository with repository root as the Vercel root and use `vercel.json`. The production frontend calls same-origin `/api`, which Vercel rewrites to the Render API. No `NEXT_PUBLIC_API_URL` is needed for the included deployment. If either deployment domain changes, update the rewrite in `vercel.json` and `FRONTEND_URL` in `render.yaml`, then redeploy both services.

## Release check

Register a creator, verify isolation, test submission both with and without a file, upload a PDF and multipart video, finalize a submission, change status as admin, confirm creator-visible messaging, and verify signed URL expiry.
