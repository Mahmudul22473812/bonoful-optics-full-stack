# Database

The production database is PostgreSQL hosted by Supabase. Its schema, migrations,
and seed program live in `backend/prisma` so Prisma resolves them from the API
package without fragile cross-package paths.

- Schema: `backend/prisma/schema.prisma`
- Migrations: `backend/prisma/migrations`
- Seed: `backend/prisma/seed.ts`

Keep credentials in deployment environment variables; never commit them here.
