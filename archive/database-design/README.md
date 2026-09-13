# Archived: database design

The app now runs as a **demo on virtual data** with no database (see
`src/lib/db.ts` and `src/lib/demo/`). Everything that made up the real
database design, and the two deployment paths built on it, is kept here
unchanged so it can be put back.

Nothing in this folder is compiled, type-checked or deployed. `tsconfig.json`
excludes `archive/`.

## What is here

| Path | What it is | Where it lived |
| --- | --- | --- |
| `prisma/schema.prisma` | The data model: 11 tables, relations, indexes, unique rules. Provider `postgresql`. | `prisma/schema.prisma` |
| `prisma/seed.mjs` | Demo seed. Skips when accounts exist unless run with `--force`. | `prisma/seed.mjs` |
| `postgres/schema.sql` | The PostgreSQL DDL Prisma generates from the schema (`prisma migrate diff`). Readable reference of every table, column, index and foreign key. | generated |
| `cloudflare-d1/migrations/0001_init.sql` | The same schema in SQLite dialect, for Cloudflare D1. | `migrations/` |
| `cloudflare-d1/seed.sql`, `export-seed-sql.mjs` | The seed as SQL for D1, and the script that produced it. | `seed/`, `scripts/` |
| `cloudflare-d1/wrangler*.jsonc`, `open-next.config.ts`, `DEPLOY.md` | Cloudflare Workers deployment (OpenNext + D1 + R2/KV). | project root |
| `app-code/src/lib/db.ts` | The Prisma client: D1 per request on Cloudflare, one long-lived client elsewhere. | `src/lib/db.ts` |
| `app-code/src/lib/files.ts` | File storage on R2, KV or local disk. | `src/lib/files.ts` |
| `app-code/test/*.mjs` | The e2e harness that copied a SQLite file and read it with Prisma. | `test/` |
| `app-code/package.json`, `next.config.ts`, `railway.json`, `.env.example` | Those files as they were with the database. | project root |
| `prisma/dev.db`, `prisma/test.db` | Local SQLite files from earlier runs. Git-ignored, local only. | `prisma/` |

The in-memory demo store was transcribed from `prisma/schema.prisma`: same
tables, columns, defaults, unique rules and relation names. The pages and
server actions did not change when the database was removed, and they will not
need to change when it comes back.

## Putting the database back

1. **Move the design back.**
   - `prisma/schema.prisma` and `prisma/seed.mjs` → `prisma/`
   - `app-code/src/lib/db.ts` and `app-code/src/lib/files.ts` → `src/lib/`
     (replacing the demo versions)
   - `app-code/test/run.mjs` and `serve-and-test.mjs` → `test/`
   - Delete `src/lib/demo/`, `src/actions/demo.ts`, `src/components/DemoReset.tsx`,
     `src/app/api/demo/` and `test/demo-db.mjs`, and remove the `railFooter`
     prop from `src/app/admin/layout.tsx` and the demo sign-in buttons in
     `src/app/login/LoginForm.tsx`.

2. **Reinstall the packages.**

   ```bash
   npm install @prisma/client@6.19.3
   npm install -D prisma@6.19.3
   # Cloudflare path only:
   npm install @opennextjs/cloudflare @prisma/adapter-d1@6.19.3
   npm install -D wrangler
   ```

3. **Restore scripts and config** from `app-code/package.json`,
   `app-code/next.config.ts`, `app-code/railway.json` and
   `app-code/.env.example`. At minimum: `"build": "prisma generate && next build"`,
   the `db:*` scripts, and `DATABASE_URL` in `.env`.

4. **Create the tables and seed.**
   - Local or any PostgreSQL: `npx prisma db push && node prisma/seed.mjs`
   - SQLite instead: set `provider = "sqlite"` and `DATABASE_URL="file:./dev.db"`.
   - Cloudflare D1: follow `cloudflare-d1/DEPLOY.md`. D1 speaks SQLite, so the
     provider must be `sqlite` for that path.

5. **Run the suite:** `npm run test:e2e`. It passed 125/125 on the database
   version and passes 125/125 on the demo version.

## Railway with PostgreSQL

`app-code/railway.json` runs `npm run db:deploy` as the pre-deploy command:
`prisma db push` then the seed, which is safe to run on every deploy because
the seed skips a database that already has accounts. Give the app service the
variable `DATABASE_URL=${{Postgres.DATABASE_URL}}`. Put the pre-deploy command
on the app service, never on the Postgres service.

## Known issue on the original development machine

On the Windows machine this was built on, Prisma's native engines crashed
(exit code `0xC0000096`) as soon as they opened a network connection to
PostgreSQL. Offline commands such as `prisma migrate diff` worked. Running the
migration from Railway's pre-deploy step avoids the local engine entirely.
