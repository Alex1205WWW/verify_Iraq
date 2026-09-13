# Verification Dispatch — MVP

A field verification dispatch platform. A verification company files a task at a
location, the operator assigns a researcher by hand over WhatsApp, and the
evidence comes back through the platform instead of through the operator's
phone.

Three roles share one application and one URL. The role on the user record
decides what the **server sends**, not just what the interface draws.

Built for Mohamm's brief. Nothing here implements a feature that was not asked
for.

> **This build is a demo on virtual data.** There is no database. The whole
> operational flow runs in the interface on data held in the server's memory,
> so it can be shown to a client from anywhere with nothing to set up. The
> database design is archived, with the steps to restore it, in
> [`archive/database-design`](archive/database-design/README.md).

---

## Running it

Node 18.18 or newer. No database, no `.env` and no API keys are needed.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The sign-in screen has one-click buttons for the
three roles.

| Role       | Email                    | Password     |
| ---------- | ------------------------ | ------------ |
| Operator   | `operator@dispatch.test` | `dispatch123` |
| Company    | `ops@gulfverify.test`    | `dispatch123` |
| Researcher | `ahmed@field.test`       | `dispatch123` |

Also seeded: `sara@`, `yusuf@`, `dilan@`, `noor@field.test`.

### How the virtual data behaves

- It is created the first time the server is used, and everything done in the
  interface changes it: offers, photos, documents, chat, approvals.
- It lasts until the server restarts. The operator can put it back to the
  starting point at any time with **Reset demo data** at the foot of the menu.
  Nobody is signed out by a reset.
- Uploaded photos and documents are held in memory with it, and go with it.
- Everyone who opens the same deployment sees the same data.

`src/lib/db.ts` answers the same queries the Prisma client did, from a small
in-memory store (`src/lib/demo/`) that follows the archived schema: same tables,
defaults, unique rules and relations. No page or server action changed when the
database was removed.

### Deploying the demo

Any Node host works, because there is nothing to provision. On Railway:

1. Point the service at this repository. Railpack detects Next.js and runs
   `npm run build`, then `npm run start` (also set in `railway.json`).
2. No variables are required. Optionally set `SESSION_SECRET` to any long
   random string so sign-ins survive a restart.
3. Generate a domain under **Settings → Networking**.

A PostgreSQL service is not used. The `DATABASE_URL` variable and any
pre-deploy command left from the database version can be deleted.

Camera capture needs HTTPS, which Railway domains provide.

### Nothing external is required

No API keys, no billing account, no Meta onboarding. Maps are OpenStreetMap
tiles through Leaflet, address search is Nominatim, the data is virtual, and
WhatsApp runs in dry run until credentials are supplied.

---

## Walking through it

The virtual data starts mid-flow so every screen has something on it.

1. **Sign in as the operator.** The dispatch map shows open tasks and the
   researchers who have reported a position. `VR-1001` needs a researcher.
2. **Open `VR-1001` → Assign a researcher.** Filter by expertise, then
   **Send offer**. With no WhatsApp credentials the message is logged to the
   terminal and the offer row is written exactly as it would be in production.
3. **Simulate accept.** The buttons appear on the offer while it is pending.
   The task moves to `assigned` and the company is notified.
4. **Sign in as the researcher** (`ahmed@field.test`). The task is on the list.
   Open it, press **Start work** — that opens the chat and unlocks the camera.
5. **Take a site photo.** Allow camera and location. Choose outside or inside.
   Camera capture needs HTTPS or `localhost`; browsers block it elsewhere.
6. **Upload the signed form** from the gallery, into its named slot.
7. **Sign in as the company** and review it. Reject one and the note lands in
   the chat. The researcher uploads v2; the old version stays in the record.
8. **Both sides mark complete.** The task closes.
9. **Try sending a phone number in the chat.** It is refused with a reason, and
   it appears in the operator's blocked-attempts log on the task.

`VR-1003` is already in progress with chat, a blocked contact attempt and a
declined offer in the history. Two applications are waiting under **Approvals**.

To show it again from the top, sign in as the operator and press
**Reset demo data**.

---

## What the design turns on

### Contact details are withheld by the server, not hidden by the interface

A company account is never *sent* a researcher's name or number. The coverage
map selects only `city`, `country`, `expertise` and coordinates
(`src/app/client/page.tsx`), so there is nothing to read out of a network tab.
Only the operator's queries include contact records.

This is the commercial point of the platform rather than a privacy nicety: it is
what keeps the operator in the middle of his own deals.

### The chat filter is honest about its limits

`src/lib/filter.ts` normalises separators and catches typed numbers and email
addresses. It cannot catch a number spelled in words or photographed on a card.
So every catch is **logged with who sent it** rather than silently dropped — the
log is the useful product, and it is on the operator's task screen.

### Photos do not trust the phone

A handset clock can be changed in seconds, and Android mock-location apps feed a
fake position to any app. So:

- the timestamp on the record is the **server's** (`serverTime`); the device's
  claim is stored beside it (`deviceTime`) only so a mismatch is visible;
- coordinates are written into **their own fields on the photo record**, not into the image's EXIF
  and not only burned onto the pixels — EXIF is rewritable and drawn text is
  editable;
- the visible stamp is still drawn on the image, because it is useful to whoever
  reads the report. It is not the part doing the security work;
- the reported **accuracy** is kept, because a fix claiming 2,000 m is worth
  less than one claiming 6 m;
- both task screens show **how far the photo was taken from the pin**, and flag
  anything beyond 250 m.

`isMockLocation` is in the schema and always `null` here. A browser cannot
report it. A native app can, and the column is ready.

### Positions update on movement, not on a timer

`LocationPinger` uses `watchPosition` and only writes to the server once the
device has moved 60 m or 30 seconds have passed. Someone sitting still costs
almost no battery and generates almost no traffic. A researcher who kills the
app to save their battery is the fastest way to make the map lie, so this is a
correctness decision as much as a cost one.

### The map loads once

Markers move over a mounted map; the map is not remounted on navigation. Google
bills Dynamic Maps per **map load**, not per marker update, so this is the
difference between staying inside a free allowance and paying for ordinary
browsing. It matters here even though the MVP is on OpenStreetMap, because the
architecture is what carries over.

### Declines are kept

Assignment is a handshake, not a command. `TaskOffer` holds one row per
researcher asked, so a decline returns the task to the queue **with the history
intact** — the operator can see who turned down what.

---

## WhatsApp

`src/lib/whatsapp.ts`. Assignment messages always reach a researcher outside the
24-hour customer service window, so they must be sent as a **pre-approved
template**. The template carries two quick-reply buttons; a tap fires the webhook
at `/api/webhooks/whatsapp`, and the reply is matched to the offer by the message
id stored when it was sent.

To go live, fill in `.env`:

```
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_TEMPLATE_NAME=task_offer
WHATSAPP_VERIFY_TOKEN=...        # also entered in Meta's webhook screen
```

Then create a `task_offer` utility template in Meta with three body variables
(researcher name, reference, address) and two quick-reply buttons. The simulate
buttons disappear as soon as credentials are present; the rest of the code path
is unchanged.

Two things worth knowing before onboarding: template messages are billed per
message, and from **1 October 2026** Meta charges for service messages after
1,000 free per business number per month.

---

## Layout

```
src/lib/demo/
  schema.ts               the 11 tables, transcribed from the archived Prisma schema
  engine.ts               in-memory store answering Prisma-shaped queries
  seed.ts                 the virtual data, mid-flow

src/lib/
  db.ts                   the `db` every page and action uses, backed by the store
  types.ts                the unions that stand in for enums
  auth.ts                 role guards — every page and action goes through these
  session.ts              signed cookie
  filter.ts               contact-detail screening
  whatsapp.ts             Cloud API adapter + dry run
  files.ts                upload storage (in memory for the demo)
  format.ts               distances, timestamps

src/actions/              server actions: auth, admin, tasks, chat, evidence
src/components/           Shell, MapCanvas, CameraCapture, ChatPanel, Documents…
src/app/admin/            5 screens — map, tasks, task detail, approvals, people
src/app/client/           4 screens — coverage, new task, tasks, task detail
src/app/researcher/       2 screens — my tasks, task detail with capture
src/app/api/              file serving, location ping, WhatsApp webhook,
                          and a read-only data route that exists only under test
archive/database-design/  the database design and its deployments, set aside
```

Uploads are held in memory with the demo data and are **never served statically** —
`/api/files/[key]` checks the caller's relationship to the task before returning
bytes.


---

## Language and theme

Both are cookies, not localStorage, so the **server** already knows them when it
renders the first byte. Arabic pages arrive with `dir="rtl"` already set rather
than flipping after hydration, and the theme never flashes the wrong palette
before correcting itself.

- **English and Arabic**, switchable from the top bar and from the sign-in
  screen — a researcher who only reads Arabic should not have to navigate an
  English login first. Arabic uses IBM Plex Sans Arabic; Archivo has no Arabic
  coverage, so weight carries the hierarchy instead of a second family.
- **Light, dark and system**, cycled from the same control.
- Directional CSS uses logical properties (`border-inline-start`,
  `inset-inline`, `padding-inline-end`), so the whole layout mirrors — the nav
  slide-over comes in from the right in Arabic, and the select arrow moves with
  it.

Stored data stays English. Expertise values, document slot labels and status
keys are canonical English strings translated only at the point of display, so
switching language never rewrites a row. Dictionaries live in
`src/lib/i18n.ts`; the English one is `as const` and the Arabic one is typed
against it, so a missing or misspelled key is a compile error rather than a
blank label.

### Two hydration traps this avoids

**Dates are never formatted twice.** `toLocaleString` disagrees between Node and
the browser — different default locale, different timezone — so a client
component formatting the same date on both sides produces a mismatch. Server
components pass **preformatted strings** into `ChatPanel` and `Documents`, and
`src/lib/format.ts` uses fixed month names instead of `Intl`.

**Leaflet is imported inside the effect, never at module scope.** Leaflet touches
`window` the moment it loads, and Next server-renders client components too, so
a top-level `import L from "leaflet"` throws
`ReferenceError: window is not defined` and takes the whole page down with it —
which is exactly what left the map empty on the file-a-task screen. The
`import type` at the top of `MapCanvas` is erased at compile time and costs
nothing.

---

## Testing

```bash
npm run test:e2e
```

Result on the demo build:

```
========================================================
  125 passed, 0 failed
========================================================

No unexpected server-side errors.
```

125 checks over real HTTP against a production build. Mutations go through the
**actual server actions**, located by the id Next embeds in the client bundle
and encoded with React's own `encodeReply`, so the harness speaks exactly the
wire format the browser speaks. A broken guard fails the suite the same way it
would fail a user.

The runner boots its own server with a fresh copy of the virtual data, so it can
be run while the demo is open in a browser. The suite checks results by reading
that data through `/api/demo/query`, a read-only route that only exists when
the runner starts the server with a random one-time token. It refuses to start
if something already owns the port, rather than silently testing a stranger's
server, and it stops the whole server process tree when it finishes.

What it covers: every route for every role; language and theme; the full
authorisation matrix including cross-tenant access; that contact details never
reach the wrong role; the three API routes; offer, decline, re-offer and accept;
start work; the chat filter against five evasion shapes and one false positive;
photo capture with its coordinates and server clock; document upload, rejection,
re-upload and versioning; dual completion and force close; task creation;
approvals, rejection, suspension; sign-in and registration.

### Two defects it caught

**Actions were dead at runtime.** `src/actions/tasks.ts` re-exported a constant,
and a `"use server"` file may only export async functions. Page renders were
fine, so nothing looked wrong — but the first action invoked on those pages
threw `A "use server" file can only export async functions`.

**Blank coordinates became 0,0.** `Number("")` is `0`, so a photo taken with no
GPS fix was stored at null island in the Atlantic, and a task filed with no
location went to the same place. On a platform whose whole premise is that a
photo can be trusted to have been taken somewhere, that is the worst possible
silent failure. `parseCoord` in `src/lib/format.ts` now refuses blanks and
out-of-range values, and the suite asserts nothing is ever stored at 0,0.

---

## Responsive

Mobile first; every breakpoint is `min-width`. Researchers work one-handed at a
gate, the operator dispatches from a desktop, and both are first-class.

- Navigation is a slide-over below 900 px and a fixed rail above it.
- Map-and-list views stack on a phone and sit side by side from 1050 px.
- Tap targets are at least 42 px; inputs are 15 px so iOS does not zoom on focus.
- Tables scroll inside their own container; the page body never scrolls sideways.
- Light and dark are both designed, following the OS unless overridden.

---

## Putting the database back

The PostgreSQL design — Prisma schema, seed, generated SQL, the Cloudflare D1
variant and the Railway pre-deploy migration — is in
[`archive/database-design`](archive/database-design/README.md), with the steps
to restore it. Because the demo store answers the same queries, restoring it
means swapping `src/lib/db.ts` and `src/lib/files.ts` back, not rewriting pages.

---

## What this MVP does not do

Each of these is a thing Mohamm described that a browser cannot do properly, or
a thing nobody asked for.

- Native iOS and Android apps, and therefore app store review.
- Location while the phone is locked or the tab is closed.
- Hardware mock-location detection.
- Push notifications outside WhatsApp.
- Payments, fees or invoicing.
- Automatic researcher matching — assignment is manual by design.
- A second interface language.
- Offline capture queueing.

The first three are the entire argument for a native researcher app in phase
two. Everything else on the brief works on the web today.
