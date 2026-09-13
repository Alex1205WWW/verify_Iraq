# Deploying the MVP to Cloudflare

The app runs on Cloudflare Workers through the OpenNext adapter, with:

| State            | Cloudflare service | Binding   |
| ---------------- | ------------------ | --------- |
| Database         | D1                 | `DB`      |
| Photos and files | R2                 | `UPLOADS` |

Workers have no persistent disk, so neither the SQLite file nor local uploads
can survive there. D1 speaks SQLite, which kept the schema change to nothing.

Local development is unchanged. `npm run dev`, `npm run test:e2e` and the
seed all still use the SQLite file and local disk. The code picks D1 and R2
only when it finds those bindings, which only exist inside Cloudflare.

---

## Deploy

Run from `DEMO/mvp`.

```bash
# 1. Sign in. Opens a browser, so run this in your own terminal.
npx wrangler login

# 2. Database. Copy the database_id it prints into wrangler.jsonc,
#    replacing 00000000-0000-0000-0000-000000000000.
npx wrangler d1 create dispatch

# 3. Photo and document storage.
npx wrangler r2 bucket create dispatch-uploads

# 4. Schema, then demo data.
npx wrangler d1 migrations apply dispatch --remote
npx wrangler d1 execute dispatch --remote --file=seed/seed.sql

# 5. Build and ship.
npm run cf:deploy

# 6. Session secret. Generated and piped straight in, never displayed.
node -e "process.stdout.write(require('crypto').randomBytes(48).toString('base64url'))" \
  | npx wrangler secret put SESSION_SECRET
```

Never reuse a secret that has appeared in a chat, a document or a commit.

---

## Demo logins

| Role       | Email                    | Password      |
| ---------- | ------------------------ | ------------- |
| Operator   | `operator@dispatch.test` | `dispatch123` |
| Company    | `ops@gulfverify.test`    | `dispatch123` |
| Researcher | `ahmed@field.test`       | `dispatch123` |

**Change these before sending the link to anyone.** The password is published
in the README.

---

## Changing the schema later

D1 does not accept `prisma db push` on this Prisma version. Instead:

```bash
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > migrations/0002_describe_change.sql

npx wrangler d1 migrations apply dispatch --remote
```

Regenerate `seed/seed.sql` from the real seed with `npm run cf:seed-sql`.

---

## WhatsApp

Left unset, so assignment offers run in dry run and the operator simulates the
researcher's Accept or Decline. Right for a demo. To send for real:

```bash
npx wrangler secret put WHATSAPP_PHONE_NUMBER_ID
npx wrangler secret put WHATSAPP_ACCESS_TOKEN
npx wrangler secret put WHATSAPP_VERIFY_TOKEN
```

Then point Meta's webhook at `https://<your-worker>/api/webhooks/whatsapp`.

---

## Known limits

**No database transactions on D1.** The app does not use any, so nothing
breaks, but multi-step writes such as accepting an offer and assigning the task
are sequential rather than atomic. That was already true on SQLite here.

**Local preview does not work on Windows.** `npm run cf:preview` builds fine
but the local workerd server hangs on the first request. OpenNext warns that it
is not fully compatible with Windows and recommends WSL. This affects only the
local preview; Cloudflare's runtime is Linux.

---

## Checking it after deploy

```bash
curl -sI https://<your-worker>/login   # expect 200
curl -sI https://<your-worker>/admin   # expect 307 to /login
npx wrangler tail                       # live logs
```
