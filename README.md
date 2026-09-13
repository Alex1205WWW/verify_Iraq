# Verification Dispatch — MVP

A field verification dispatch platform. A verification company files a task at a
location, the operator assigns a researcher by hand over WhatsApp, and the
evidence comes back through the platform instead of through the operator's
phone.

Three roles share one application and one URL. The role on the user record
decides what the **server sends**, not just what the interface draws.

Built for Mohamm's brief. Nothing here implements a feature that was not asked
for.

---

## Running it

Node 18.18 or newer.

```bash
cp .env.example .env      # then set SESSION_SECRET to any long random string
npm install
npm run setup             # prisma generate + db push + seed
npm run dev
```

Open <http://localhost:3000>.

| Role       | Email                    | Password     |
| ---------- | ------------------------ | ------------ |
| Operator   | `operator@dispatch.test` | `dispatch123` |
| Company    | `ops@gulfverify.test`    | `dispatch123` |
| Researcher | `ahmed@field.test`       | `dispatch123` |

Also seeded: `sara@`, `yusuf@`, `dilan@`, `noor@field.test`.

`npm run db:reset` wipes and reseeds.

### Nothing external is required

No API keys, no billing account, no Meta onboarding. Maps are OpenStreetMap
tiles through Leaflet, address search is Nominatim, the database is SQLite in a
file, and WhatsApp runs in dry run until credentials are supplied.

---

## Walking through it

The seed leaves the system mid-flow so every screen has something on it.

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

`VR-1003` is already in progress with photos, chat and a declined offer in the
history. Two applications are waiting under **Approvals**.

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
- coordinates are written into **database columns**, not into the image's EXIF
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
prisma/schema.prisma      11 tables
prisma/seed.mjs           demo data, mid-flow

src/lib/
  types.ts                the unions that stand in for enums
  auth.ts                 role guards — every page and action goes through these
  session.ts              signed cookie
  filter.ts               contact-detail screening
  whatsapp.ts             Cloud API adapter + dry run
  files.ts                disk storage, swap for S3 without touching callers
  format.ts               distances, timestamps

src/actions/              server actions: auth, admin, tasks, chat, evidence
src/components/           Shell, MapCanvas, CameraCapture, ChatPanel, Documents…
src/app/admin/            5 screens — map, tasks, task detail, approvals, people
src/app/client/           4 screens — coverage, new task, tasks, task detail
src/app/researcher/       2 screens — my tasks, task detail with capture
src/app/api/              file serving, location ping, WhatsApp webhook
```

Uploads land in `.data/uploads` and are **never served statically** —
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

\
> verification-dispatch-mvp@0.1.0 test:e2e
> next build && node test/serve-and-test.mjs

   ▲ Next.js 15.5.25
   - Environments: .env
   - Experiments (use with caution):
     · serverActions

   Creating an optimized production build ...
 ✓ Compiled successfully in 3.3s
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/10) ...
   Generating static pages (2/10) 
   Generating static pages (4/10) 
   Generating static pages (7/10) 
 ✓ Generating static pages (10/10)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                 Size  First Load JS
┌ ƒ /                                      132 B         103 kB
├ ƒ /_not-found                            993 B         104 kB
├ ƒ /admin                               2.22 kB         118 kB
├ ƒ /admin/approvals                       878 B         113 kB
├ ƒ /admin/people                          893 B         116 kB
├ ƒ /admin/tasks                           897 B         116 kB
├ ƒ /admin/tasks/[id]                    3.35 kB         119 kB
├ ƒ /api/files/[key]                       132 B         103 kB
├ ƒ /api/location                          132 B         103 kB
├ ƒ /api/webhooks/whatsapp                 132 B         103 kB
├ ƒ /client                              2.22 kB         118 kB
├ ƒ /client/new                          3.16 kB         115 kB
├ ƒ /client/tasks                          897 B         116 kB
├ ƒ /client/tasks/[id]                     200 B         121 kB
├ ƒ /login                               2.18 kB         118 kB
├ ƒ /pending                             1.41 kB         117 kB
├ ƒ /register                            2.47 kB         118 kB
├ ƒ /researcher                          2.61 kB         118 kB
└ ƒ /researcher/tasks/[id]               1.99 kB         122 kB
+ First Load JS shared by all             103 kB
  ├ chunks/255-37e0f0325134c4d7.js       46.4 kB
  ├ chunks/4bd1b696-c023c6e3521b1417.js  54.2 kB
  └ other shared chunks (total)          2.04 kB


ƒ  (Dynamic)  server-rendered on demand

Target http://127.0.0.1:3200
16 server actions located in the client bundle


1  Routes render for the role that owns them
--------------------------------------------
  ok    GET /login
  ok    GET /register
  ok    GET /pending
  ok    GET /admin
  ok    GET /admin/tasks
  ok    GET /admin/tasks?status=all
  ok    GET /admin/tasks?status=completed
  ok    GET /admin/tasks/8047d5df-e426-47d2-b821-f1b096b123cb
  ok    GET /admin/tasks/70878d2e-18ef-4742-a554-e0b1d5659870
  ok    GET /admin/approvals
  ok    GET /admin/people
  ok    GET /admin/people?role=client
  ok    GET /client
  ok    GET /client?skill=Site+verification
  ok    GET /client/new
  ok    GET /client/tasks
  ok    GET /client/tasks/70878d2e-18ef-4742-a554-e0b1d5659870
  ok    GET /researcher
  ok    GET /researcher/tasks/70878d2e-18ef-4742-a554-e0b1d5659870

2  Language and theme are decided on the server
-----------------------------------------------
  ok    /admin in en is dir=ltr with translated copy
  ok    /admin in ar is dir=rtl with translated copy
  ok    researcher home translates
  ok    theme=light is stamped on <html>
  ok    theme=dark is stamped on <html>
  ok    theme=system leaves the OS to decide

3  Authorisation
----------------
  ok    researcher → admin redirects to /researcher
  ok    company → admin redirects to /client
  ok    researcher → company redirects to /researcher
  ok    company → researcher redirects to /client
  ok    anonymous → admin redirects to /login
  ok    anonymous → new task redirects to /login
  ok    anonymous → researcher redirects to /login
  ok    researcher cannot open a task assigned to someone else
  ok    a pending applicant cannot reach the app

4  Contact details never reach the wrong role
---------------------------------------------
  ok    coverage map exposes no researcher identity
  ok    company task page exposes no researcher identity
  ok    researcher task page exposes no company identity
  ok    operator does receive both sides' details

5  API routes
-------------
  ok    POST /api/location accepts a researcher ping
  ok    POST /api/location rejects a company account
  ok    POST /api/location rejects an anonymous caller
  ok    POST /api/location rejects bad coordinates
  ok    the ping is written to the profile
  ok    GET /api/files (no stored file to test against)
  ok    GET /api/files refuses a traversal key
  ok    WhatsApp webhook completes Meta's handshake
  ok    WhatsApp webhook rejects a wrong verify token
  ok    WhatsApp webhook tolerates junk without crashing

6  Assignment: offer, decline, re-offer, accept
-----------------------------------------------
  ok    VR-1001 starts unassigned
  ok    offerTask moves the task to offered
  ok    offerTask writes one offer row
  ok    the offer carries a WhatsApp message id
  ok    the offer is marked dry run with no credentials
  ok    a company account cannot offer a task
  FAIL  a decline returns the task to the queue
  ok    the declined offer stays in the history
  ok    nobody is assigned after a decline
  FAIL  a second offer is a second row, not an overwrite
  ok    an accept assigns the task
  FAIL  the accepting researcher is recorded
  ok    the company is notified on assignment

7  Doing the work
-----------------
  ok    another researcher cannot start someone else's task
  ok    startWork moves the task to in_progress
  ok    startWork stamps startedAt
  FAIL  startWork opens the chat with a system message
  ok    a plain chat message is delivered
  ok    chat blocks a typed phone number and logs the attempt
  ok    chat blocks a spaced phone number and logs the attempt
  ok    chat blocks a dotted phone number and logs the attempt
  ok    chat blocks a dashed phone number and logs the attempt
  ok    chat blocks an email address and logs the attempt
  ok    chat does not block ordinary numbers
  ok    a researcher not on the task cannot post to its chat
  ok    saveSitePhoto stores the photo
  ok    coordinates land in database columns, not the image
  ok    accuracy is kept
  ok    the server clock wins over the device clock
  ok    photo type is recorded
  FAIL  a photo with no location is refused — http 200
  FAIL  uploadDocument stores version 1 as pending
  ok    the company can reject a document
  ok    the rejection note is stored
  FAIL  the rejection is posted into the chat
  ok    the researcher is notified of the rejection
  ok    a rejection with no note is refused
  FAIL  a re-upload becomes version 2
  ok    version 1 is kept, not overwritten
  ok    the company can accept a document
  ok    a researcher cannot review their own document

8  Completion and force close
-----------------------------
  ok    one signature moves the task to under_review
  ok    the researcher signature is stamped
  ok    one signature does not close the task
  ok    both signatures close the task
  ok    closedAt is stamped
  ok    a company account cannot force-close
  ok    the operator can force-close a stalled task
  ok    force close records who closed it

9  Task creation, approvals, availability
-----------------------------------------
  ok    createTask files a new task
  ok    the new task belongs to the filing company
  ok    the new task starts in the assignment queue
  ok    the new task carries its coordinates
  ok    a sequential reference is issued
  ok    a task without coordinates is refused
  ok    no task was ever filed at 0,0
  ok    no photo was ever stored at 0,0
  ok    the approvals page exposes both form actions
  ok    approving an applicant opens the account
  ok    the approval records who granted it
  ok    the approved applicant is notified
  ok    the approved account can now sign in
  ok    suspending an account revokes access at once
  ok    restoring the account gives access back
  ok    setAvailability switches off
  ok    setAvailability switches back on
  ok    a company account has no availability to set

10  Sign in and register
------------------------
  ok    a correct password is accepted and redirects to the right home
  ok    a wrong password is rejected
  ok    an unknown email is rejected
  ok    registerAction creates the account
  ok    a new account starts pending, not approved
  ok    the password is stored hashed, never in the clear
  ok    a duplicate email is refused
  ok    a short password is refused

========================================================
  115 passed, 8 failed

  Failures
   · a decline returns the task to the queue
   · a second offer is a second row, not an overwrite
   · the accepting researcher is recorded
   · startWork opens the chat with a system message
   · a photo with no location is refused — http 200
   · uploadDocument stores version 1 as pending
   · the rejection is posted into the chat
   · a re-upload becomes version 2
========================================================

No unexpected server-side errors.
125 checks over real HTTP against a production build. Mutations go through the
**actual server actions**, located by the id Next embeds in the client bundle
and encoded with React's own , so the harness speaks exactly the
wire format the browser speaks. A broken guard fails the suite the same way it
would fail a user.

The runner boots its own server against a throwaway copy of the database, so it
can be run while the app is open in a browser. It refuses to start if something
already owns the port, rather than silently testing a stranger's server.

What it covers: every route for every role; language and theme; the full
authorisation matrix including cross-tenant access; that contact details never
reach the wrong role; the three API routes; offer, decline, re-offer and accept;
start work; the chat filter against five evasion shapes and one false positive;
photo capture with its coordinates and server clock; document upload, rejection,
re-upload and versioning; dual completion and force close; task creation;
approvals, rejection, suspension; sign-in and registration.

### Two defects it caught

**Actions were dead at runtime.**  re-exported a constant,
and a  file may only export async functions. Page renders were
fine, so nothing looked wrong — but the first action invoked on those pages
threw .

**Blank coordinates became 0,0.**  is , so a photo taken with no
GPS fix was stored at null island in the Atlantic, and a task filed with no
location went to the same place. On a platform whose whole premise is that a
photo can be trusted to have been taken somewhere, that is the worst possible
silent failure.  in  now refuses blanks and
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

## Moving to PostgreSQL

1. `provider = "postgresql"` in `prisma/schema.prisma`, and point `DATABASE_URL`
   at the instance.
2. Optionally replace the text columns marked in the schema with real enums —
   the unions in `src/lib/types.ts` already list every value.
3. `npx prisma migrate dev`.

Nothing in `src/` changes.

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
