# Orion Santé

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — managed API workflow
- `pnpm --filter @workspace/orion-sante run dev` — managed web workflow
- `pnpm run typecheck` — type checks
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client and server validators after contract edits
- `pnpm --filter @workspace/db run push` — apply development schema

## Stack

React + Vite, Express 5, PostgreSQL/Drizzle, OpenAPI/Orval, React Query, Clerk.
Use managed artifact workflows, not standalone dev processes. Web app preview is `/`; shared API is `/api`.

## Cloudflare preparation

- See `docs/cloudflare.md` for the full frontend + Express Workers setup and approval gates.
- `pnpm run cf:check` builds frontend + dry-run Worker, without publishing.
- `pnpm --filter @workspace/api-server run cf:test:runtime` checks the API journey in local workerd after the dry-run.
- `pnpm run cf:deploy:preview:secure` uploads a preview version to the existing **main** `orion-sante` Worker. It must not create a second Worker or deploy the version to production traffic.
- No build command migrates data or changes DNS. Remote PostgreSQL connectivity and Clerk must be validated on the actual Cloudflare preview before production approval.

## Data and financial integrity

- Clinic data is isolated by verified Clerk user ID. Anonymous demonstrations use a separate opaque HttpOnly cookie; never use an anonymous cookie to authorize a signed-in clinic.
- Each account owns its own clinic. This version has no shared team invitations or staff RBAC.
- Each clinic is a PostgreSQL JSONB aggregate. Financial mutations acquire a row lock, check balances, and save atomically.
- Issued invoices and payments are not deletable or editable. Payment request IDs are idempotent; receipt and invoice numbers are allocated inside the transaction.
- Prices and amounts are integer XOF; Togo dates use Africa/Lome (UTC).
- Mobile-money methods record externally confirmed payments; no automatic TMoney/Flooz collection integration exists.
- Anonymous demonstration records are fictitious. Signed-in clinics start empty. Never seed medical examples into a real account.
- Reports are operational financial reports, not a certified general ledger or a compliance certification. Review local accounting, privacy, hosting and operational requirements before real patient use.

## Key locations

- `lib/api-spec/openapi.yaml` — source of truth for contracts
- `lib/db/src/schema/clinics.ts` — persisted clinics
- `artifacts/api-server/src/routes/clinic.ts` — validations, transaction boundary, clinic authorization
- `artifacts/api-server/src/lib/clinic-data.ts` — demo seed, dashboard totals and cash balance
- `artifacts/orion-sante/src/` — frontend

## External production database target

The creator approved a separate Neon PostgreSQL database for Cloudflare production.

- Neon project: `orion-sante` (`old-sunset-70783495`)
- Default branch: `production` (`br-shy-lab-b95muldc`)
- Region: `aws-eu-central-1` (Frankfurt)
- The `public.clinics` schema has been initialized without application records.
- The current Replit preview still uses its existing development `DATABASE_URL`; it was not replaced.
- Cloudflare connectivity and secret injection are not configured yet. Never print or commit a connection string, and never treat creation of this database as proof of a successful Cloudflare deployment.
