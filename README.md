# ContentFlow API

NestJS API backed exclusively by Supabase hosted PostgreSQL through Prisma ORM 6. No local database or Docker service is required.

## Requirements

- Node.js 20 or newer and npm
- A Supabase project

## 1. Create a Supabase project

Create a project in the Supabase dashboard and save its database password securely. Wait for provisioning to finish. The API uses PostgreSQL only; it does not need a Supabase browser SDK or a service-role key.

## 2. Find connection strings

In the project dashboard select **Connect** and find the PostgreSQL connection strings. Copy the **Transaction pooler** URI for runtime and the **Direct connection** URI for Prisma migrations. If direct IPv6 connectivity is unavailable in your deployment, Supabase's session pooler can be used for migrations instead.

## 3. Configure environment variables

Copy `.env.example` to `.env` in `apps/api` and replace placeholders with your project values:

```dotenv
DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"
DIRECT_URL="postgresql://...@db.<project-ref>.supabase.co:5432/postgres?sslmode=require"
JWT_SECRET="a-long-random-secret-generated-for-this-deployment"
PORT=4000
WEB_ORIGIN="http://localhost:3000"
```

Use the exact connection strings Supabase displays; URL-encode special characters in passwords. Keep `.env` and all credentials out of version control. The frontend must never receive either database URL or a Supabase service-role key. `WEB_ORIGIN` should be the deployed frontend origin in production.

## 4. Install and migrate

From this directory:

```sh
npm ci
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
```

`DIRECT_URL` is used by Prisma Migrate while `DATABASE_URL` is used by the running API. For a new migration during local development, make a schema change and run `npx prisma migrate dev --name <descriptive_name>` against the Supabase development project. Commit the resulting migration and use `npx prisma migrate deploy` in deployment. Do not point migration commands at production while iterating.

The seed creates a demo agency, demo clients, calendar entries, and `admin@contentflow.local`. Its initial password is `ChangeMe123!`; change it immediately and do not use the demo seed in a production project. Seed execution is repeatable for the included demo records.

## 5. Run NestJS against Supabase

Start the API with `npm run start:dev` or build and run with `npm run build && npm start`. `PrismaService` connects using the server-side `DATABASE_URL`. The API must run in a trusted server environment. Keep database URLs and `JWT_SECRET` in the hosting provider's secret manager, never in Next.js public environment variables, browser code, or client bundles.

## 6. Database security

The initial migration enables row-level security on application tables and installs deny policies for Supabase `anon` and `authenticated` roles. The API connects using the project's PostgreSQL owner connection and therefore does not rely on RLS to authorize end users. NestJS verifies its own JWT and scopes client and content queries by the authenticated user's agency/client membership. Keep this authorization in place for every new query and endpoint.

Public calendar sharing is served by the NestJS API and returns only approved or published content fields. It never returns notes, review comments, user data, credentials, or shoot records. Never expose a service-role key or database connection string to the browser. If adding direct Supabase client access later, replace the deny policies with narrowly scoped policies backed by trusted Supabase Auth claims and validate those policies independently.

## 7. Deploy the backend

Deploy `apps/api` as a Node.js service. Configure `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `PORT`, and `WEB_ORIGIN` as server-side environment variables. Build with `npm ci && npx prisma generate && npm run build`. Run `npx prisma migrate deploy` as a release step before starting the new API version. Run `npx prisma db seed` only when demo data is intentionally wanted. Use HTTPS, rotate secrets through the hosting provider, and restrict production database access to the backend environment.

## Schema

The Prisma schema includes `users`, `clients`, `client_members`, `calendars`, `content_items`, `templates`, `color_palettes`, and `calendar_shares`, plus the agency, approvals, refresh-token, and legacy content records used by existing API routes. Calendar design and presentation configuration use PostgreSQL `JSONB`.

