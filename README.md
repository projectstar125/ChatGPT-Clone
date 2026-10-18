# Multi-user AI Chat

A Next.js App Router starter for a private multi-user AI chat app with PostgreSQL/Prisma, bcrypt password hashing, opaque server-side sessions, OpenAI Chat Completions streaming, conversation history, and per-user token/cost accounting.

> This is a security-conscious starter, not a claim of audited production readiness. Before exposing it publicly, use a distributed rate limiter, test deployment streaming, configure backups/monitoring, and review your provider's current API pricing.

## Requirements
- Node.js 20.19+ (Node 22 LTS recommended)
- PostgreSQL database (Supabase, Neon, or managed PostgreSQL)
- OpenAI API account and API key; ChatGPT Plus does not include API usage

## 1. Create the project

If you already downloaded this starter, open its folder in VS Code. Otherwise create a Next.js project with TypeScript, App Router, Tailwind and import/copy these files.

```bash
npm install
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

## 2. Configure environment

Fill in `.env`:
- `DATABASE_URL`: PostgreSQL connection string.
- `OPENAI_API_KEY`: secret API key; never use a `NEXT_PUBLIC_` prefix.
- `OPENAI_MODEL`: `gpt-4o-mini` by default, or a model enabled for your API project.
- `INPUT_PRICE_PER_MILLION` / `OUTPUT_PRICE_PER_MILLION`: current rates for the chosen model, in USD per million tokens. Check official pricing before setting these values.
- `APP_URL`: your origin, e.g. `http://localhost:3000` locally and your HTTPS URL in production.

## 3. Initialize database

```bash
npx prisma generate
npx prisma migrate dev --name init
```

For deployment, apply committed migrations with `npx prisma migrate deploy`; don't run `migrate dev` in production.

## 4. Run locally

```bash
npm run dev
```

Open http://localhost:3000/register. Create an account. All self-registered accounts start as regular users. Promote a trusted account to admin manually from a secure database session, for example: `UPDATE "User" SET role = 'ADMIN' WHERE email = 'trusted-admin@example.com';`. Never expose admin provisioning through public registration.

## 5. Test

- Register two accounts and confirm each sees only their own conversations.
- Send multiple prompts and confirm assistant streaming works.
- Check the usage summary after responses.
- Test invalid credentials, oversized prompts, deleting a conversation, refresh/re-login, and API errors.
- Confirm the OpenAI stream completes with usage metadata for the selected model.

## 6. Deploy

Deploy to Vercel or another Node.js host that supports Next.js route-handler streaming. Configure all environment variables in the host dashboard, set `APP_URL` to the production HTTPS origin, configure a managed PostgreSQL database, and run `npx prisma migrate deploy` as a release step. Then deploy the app. Ensure proxy/CDN buffering is disabled for `/api/chat` and the host's function timeout allows your expected response duration.

## Important production hardening

- The included rate limiter is in-memory and is **not sufficient for multi-instance deployment**. Replace `lib/rate-limit.ts` with Redis/Upstash or your hosting platform's distributed limiter.
- Add email verification, password reset, account deletion, admin-only account management, and audit logs before public launch.
- Add quotas and spend limits. A small user count does not automatically cap OpenAI spending.
- Configure database backups, TLS, monitoring, alerting, and retention policies.
- The stream can be interrupted before usage metadata arrives. Such messages are marked `unknown` or `usage_unavailable`; cost cannot be accurately inferred without confirmed provider usage.
- `ADMIN_EMAILS` is convenient for a private first deployment but not a complete admin provisioning workflow. Disable open registration or use an invitation-only flow if needed.
- Token costs are estimates based on configurable rates and do not account for every possible pricing modifier (cached tokens, tool calls, discounts, etc.).
