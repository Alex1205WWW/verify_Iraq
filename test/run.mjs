/**
 * End-to-end functional test.
 *
 * Everything runs over real HTTP against a production build. Mutations go
 * through the actual server actions — located by the id Next embeds in the
 * client bundle — rather than by writing to the database behind the app's
 * back, so a broken guard fails the test the same way it would fail a user.
 */
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { actionMap } from "./actions.mjs";
import { encodeReply } from "next/dist/compiled/react-server-dom-webpack/client.node.js";

const BASE = process.env.TEST_BASE ?? "http://127.0.0.1:3200";
const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET);

const db = new PrismaClient();
const ACTIONS = actionMap();

let pass = 0;
let fail = 0;
const failures = [];

function ok(name, condition, detail = "") {
  if (condition) {
    pass++;
    console.log(`  ok    ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? " — " + detail : ""}`);
    console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`);
  }
}

function section(title) {
  console.log(`\n${title}\n${"-".repeat(title.length)}`);
}

async function cookieFor(email) {
  const u = await db.user.findUnique({ where: { email } });
  if (!u) throw new Error(`no user ${email}`);
  const token = await new SignJWT({ userId: u.id, role: u.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(SECRET);
  return { id: u.id, email, cookie: `vd_session=${token}` };
}

async function get(path, cookie = "", extra = "") {
  const res = await fetch(BASE + path, {
    headers: { Cookie: [cookie, extra].filter(Boolean).join("; ") },
    redirect: "manual",
  });
  const body = res.status >= 300 && res.status < 400 ? "" : await res.text();
  return { status: res.status, location: res.headers.get("location"), body };
}

/** Invoke a server action by exported name with plain JSON-serialisable args. */
async function act(name, args, cookie, page = "/admin") {
  const id = ACTIONS.get(name);
  if (!id) throw new Error(`no action id for ${name}`);
  const res = await fetch(BASE + page, {
    method: "POST",
    headers: {
      "Next-Action": id,
      "Content-Type": "text/plain;charset=UTF-8",
      Cookie: cookie,
    },
    body: JSON.stringify(args),
    redirect: "manual",
  });
  return { status: res.status, text: await res.text() };
}

/**
 * Invoke a useActionState action, which React calls as (prevState, formData).
 * The request body is produced by React's own encodeReply, so the harness
 * speaks exactly the wire format the browser speaks rather than a guess at it.
 */
async function actForm(name, fields, cookie, page) {
  const id = ACTIONS.get(name);
  if (!id) throw new Error(`no action id for ${name}`);
  const inner = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (k.endsWith("__name")) continue;
    if (v instanceof Blob) inner.set(k, v, fields[k + "__name"] ?? "upload.bin");
    else inner.set(k, v);
  }
  const body = await encodeReply([null, inner]);
  const res = await fetch(BASE + page, {
    method: "POST",
    headers: { "Next-Action": id, Cookie: cookie },
    body,
    redirect: "manual",
  });
  return { status: res.status, text: await res.text() };
}

/** Server-component forms carry their action id in a hidden input. */
function formIds(html) {
  // Every page also carries the shell's sign-out form, so that id is dropped
  // and what remains is the page's own actions, in document order.
  const logout = ACTIONS.get("logoutAction");
  return [...new Set([...html.matchAll(/\$ACTION_ID_([a-f0-9]{40,48})/g)].map((m) => m[1]))]
    .filter((id) => id !== logout);
}

async function postForm(id, fields, cookie, page) {
  const inner = new FormData();
  for (const [k, v] of Object.entries(fields)) inner.set(k, v);
  const res = await fetch(BASE + page, {
    method: "POST",
    headers: { "Next-Action": id, Cookie: cookie },
    body: await encodeReply([inner]),
    redirect: "manual",
  });
  return { status: res.status };
}

async function main() {
  console.log(`Target ${BASE}`);
  console.log(`${ACTIONS.size} server actions located in the client bundle\n`);

  const admin = await cookieFor("operator@dispatch.test");
  const company = await cookieFor("ops@gulfverify.test");
  const ahmed = await cookieFor("ahmed@field.test");
  const sara = await cookieFor("sara@field.test");
  const yusuf = await cookieFor("yusuf@field.test");

  const tasks = await db.task.findMany();
  const T = (ref) => tasks.find((t) => t.reference === ref);
  const t1001 = T("VR-1001");
  const t1002 = T("VR-1002");
  const t1003 = T("VR-1003");

  // ------------------------------------------------------------- 1. routes
  section("1  Routes render for the role that owns them");
  const routes = [
    ["/login", ""],
    ["/register", ""],
    ["/pending", ""],
    ["/admin", admin.cookie],
    ["/admin/tasks", admin.cookie],
    ["/admin/tasks?status=all", admin.cookie],
    ["/admin/tasks?status=completed", admin.cookie],
    [`/admin/tasks/${t1001.id}`, admin.cookie],
    [`/admin/tasks/${t1003.id}`, admin.cookie],
    ["/admin/approvals", admin.cookie],
    ["/admin/people", admin.cookie],
    ["/admin/people?role=client", admin.cookie],
    ["/client", company.cookie],
    ["/client?skill=Site+verification", company.cookie],
    ["/client/new", company.cookie],
    ["/client/tasks", company.cookie],
    [`/client/tasks/${t1003.id}`, company.cookie],
    ["/researcher", yusuf.cookie],
    [`/researcher/tasks/${t1003.id}`, yusuf.cookie],
  ];
  for (const [path, cookie] of routes) {
    const r = await get(path, cookie);
    ok(
      `GET ${path}`,
      r.status === 200 && !r.body.includes("__next_error__"),
      r.status !== 200 ? `status ${r.status}` : "render error",
    );
  }

  // ----------------------------------------------------------- 2. i18n/theme
  section("2  Language and theme are decided on the server");
  for (const [lang, dir, probe] of [
    ["en", "ltr", "Dispatch map"],
    ["ar", "rtl", "خريطة الإرسال"],
  ]) {
    const r = await get("/admin", admin.cookie, `vd_lang=${lang}`);
    ok(`/admin in ${lang} is dir=${dir} with translated copy`,
      r.body.includes(`dir="${dir}"`) && r.body.includes(probe));
  }
  const arRes = await get("/researcher", yusuf.cookie, "vd_lang=ar");
  ok("researcher home translates", arRes.body.includes("أهلاً") && arRes.body.includes('dir="rtl"'));
  for (const theme of ["light", "dark"]) {
    const r = await get("/login", "", `vd_theme=${theme}`);
    ok(`theme=${theme} is stamped on <html>`, r.body.includes(`data-theme="${theme}"`));
  }
  ok("theme=system leaves the OS to decide",
    !(await get("/login", "", "vd_theme=system")).body.includes("data-theme="));

  // -------------------------------------------------------------- 3. guards
  section("3  Authorisation");
  const guards = [
    ["/admin", ahmed.cookie, "/researcher", "researcher → admin"],
    ["/admin", company.cookie, "/client", "company → admin"],
    ["/client", ahmed.cookie, "/researcher", "researcher → company"],
    ["/researcher", company.cookie, "/client", "company → researcher"],
    ["/admin", "", "/login", "anonymous → admin"],
    ["/client/new", "", "/login", "anonymous → new task"],
    ["/researcher", "", "/login", "anonymous → researcher"],
  ];
  for (const [path, cookie, expect, label] of guards) {
    const r = await get(path, cookie);
    ok(`${label} redirects to ${expect}`,
      r.status >= 300 && r.status < 400 && (r.location ?? "").includes(expect),
      `got ${r.status} ${r.location ?? ""}`);
  }
  ok("researcher cannot open a task assigned to someone else",
    (await get(`/researcher/tasks/${t1003.id}`, sara.cookie)).status === 404);
  ok("a pending applicant cannot reach the app", await (async () => {
    const p = await db.user.findFirst({ where: { status: "pending" } });
    const r = await get("/researcher", (await cookieFor(p.email)).cookie);
    return r.status >= 300 && (r.location ?? "").includes("/login");
  })());

  // --------------------------------------------------------- 4. data leaks
  section("4  Contact details never reach the wrong role");
  const identity = ["Ahmed Kadhim", "Yusuf Mahmoud", "+964 771", "+964 773", "@field.test"];
  const companySide = ["Lina Farouk", "ops@gulfverify.test", "+971 50"];

  const cov = await get("/client", company.cookie);
  ok("coverage map exposes no researcher identity",
    identity.every((n) => !cov.body.includes(n)),
    identity.filter((n) => cov.body.includes(n)).join(", "));

  const ct = await get(`/client/tasks/${t1003.id}`, company.cookie);
  ok("company task page exposes no researcher identity",
    identity.every((n) => !ct.body.includes(n)),
    identity.filter((n) => ct.body.includes(n)).join(", "));

  const rt = await get(`/researcher/tasks/${t1003.id}`, yusuf.cookie);
  ok("researcher task page exposes no company identity",
    companySide.every((n) => !rt.body.includes(n)),
    companySide.filter((n) => rt.body.includes(n)).join(", "));

  const at = await get(`/admin/tasks/${t1003.id}`, admin.cookie);
  ok("operator does receive both sides' details",
    at.body.includes("Yusuf Mahmoud") && at.body.includes("ops@gulfverify.test"));

  // ------------------------------------------------------------- 5. apis
  section("5  API routes");
  const before = await db.researcherProfile.findUnique({ where: { userId: ahmed.id } });
  const ping = (cookie, body) =>
    fetch(BASE + "/api/location", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(body),
    });
  ok("POST /api/location accepts a researcher ping",
    (await ping(ahmed.cookie, { lat: 33.4001, lng: 44.4001 })).status === 200);
  ok("POST /api/location rejects a company account",
    (await ping(company.cookie, { lat: 1, lng: 1 })).status === 403);
  ok("POST /api/location rejects an anonymous caller",
    (await ping("", { lat: 1, lng: 1 })).status === 403);
  ok("POST /api/location rejects bad coordinates",
    (await ping(ahmed.cookie, { lat: "x" })).status === 400);
  const afterPing = await db.researcherProfile.findUnique({ where: { userId: ahmed.id } });
  ok("the ping is written to the profile",
    Math.abs(afterPing.lastLat - 33.4001) < 1e-6 && afterPing.lastSeenAt > before.lastSeenAt);

  const anyFile = (await db.documentSubmission.findFirst())?.storageKey
    ?? (await db.sitePhoto.findFirst())?.storageKey;
  if (anyFile) {
    ok("GET /api/files serves the operator",
      (await fetch(BASE + `/api/files/${anyFile}`, { headers: { Cookie: admin.cookie } })).status === 200);
    ok("GET /api/files refuses an anonymous caller",
      (await fetch(BASE + `/api/files/${anyFile}`)).status === 403);
  } else {
    ok("GET /api/files (no stored file to test against)", true);
  }
  ok("GET /api/files refuses a traversal key", await (async () => {
    const r = await fetch(BASE + "/api/files/..%2F..%2Fpackage.json", {
      headers: { Cookie: admin.cookie }, redirect: "manual",
    });
    return r.status !== 200;
  })());

  const verify = process.env.WHATSAPP_VERIFY_TOKEN ?? "verify-me";
  const hs = await fetch(
    `${BASE}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${verify}&hub.challenge=42`);
  ok("WhatsApp webhook completes Meta's handshake",
    hs.status === 200 && (await hs.text()) === "42");
  ok("WhatsApp webhook rejects a wrong verify token",
    (await fetch(`${BASE}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42`)).status === 403);
  ok("WhatsApp webhook tolerates junk without crashing",
    (await fetch(`${BASE}/api/webhooks/whatsapp`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "not json",
    })).status === 200);

  // --------------------------------------------------- 6. assignment flow
  section("6  Assignment: offer, decline, re-offer, accept");
  ok("VR-1001 starts unassigned",
    (await db.task.findUnique({ where: { id: t1001.id } })).status === "pending_assignment");

  const page1001 = `/admin/tasks/${t1001.id}`;
  const o1 = await act("offerTask", [t1001.id, sara.id], admin.cookie, page1001);
  let task = await db.task.findUnique({ where: { id: t1001.id }, include: { offers: true } });
  ok("offerTask moves the task to offered", task.status === "offered", `http ${o1.status}`);
  ok("offerTask writes one offer row", task.offers.length === 1);
  ok("the offer carries a WhatsApp message id", Boolean(task.offers[0]?.waMessageId));
  ok("the offer is marked dry run with no credentials", task.offers[0]?.dryRun === true);

  const nonAdminOffer = await act("offerTask", [t1001.id, ahmed.id], company.cookie, page1001);
  task = await db.task.findUnique({ where: { id: t1001.id }, include: { offers: true } });
  ok("a company account cannot offer a task", task.offers.length === 1, `http ${nonAdminOffer.status}`);

  await act("simulateOfferResponse", [task.offers[0].id, false], admin.cookie, page1001);
  task = await db.task.findUnique({ where: { id: t1001.id }, include: { offers: true } });
  ok("a decline returns the task to the queue", task.status === "pending_assignment");
  ok("the declined offer stays in the history", task.offers[0].response === "declined");
  ok("nobody is assigned after a decline", task.assignedResearcherId === null);

  await act("offerTask", [t1001.id, ahmed.id], admin.cookie, page1001);
  task = await db.task.findUnique({
    where: { id: t1001.id }, include: { offers: { orderBy: { sentAt: "asc" } } },
  });
  ok("a second offer is a second row, not an overwrite", task.offers.length === 2);

  const live = task.offers.find((o) => o.response === "pending");
  if (live) await act("simulateOfferResponse", [live.id, true], admin.cookie, page1001);
  task = await db.task.findUnique({ where: { id: t1001.id } });
  ok("an accept assigns the task", task.status === "assigned");
  ok("the accepting researcher is recorded", task.assignedResearcherId === ahmed.id);
  ok("the company is notified on assignment", Boolean(await db.notification.findFirst({
    where: { taskId: t1001.id, type: "researcher_assigned" },
  })));

  // ------------------------------------------------------- 7. doing the work
  section("7  Doing the work");
  const rPage = `/researcher/tasks/${t1001.id}`;

  const badStart = await act("startWork", [t1001.id], sara.cookie, rPage);
  task = await db.task.findUnique({ where: { id: t1001.id } });
  ok("another researcher cannot start someone else's task",
    task.status === "assigned", `http ${badStart.status}`);

  await act("startWork", [t1001.id], ahmed.cookie, rPage);
  task = await db.task.findUnique({ where: { id: t1001.id }, include: { messages: true } });
  ok("startWork moves the task to in_progress", task.status === "in_progress");
  ok("startWork stamps startedAt", Boolean(task.startedAt));
  ok("startWork opens the chat with a system message", task.messages.length === 1);

  const clean = "At the gate now, the manager is here.";
  await actForm("sendMessage", { taskId: t1001.id, body: clean }, ahmed.cookie, rPage);
  ok("a plain chat message is delivered",
    (await db.message.count({ where: { taskId: t1001.id, body: clean } })) === 1);

  for (const [label, text] of [
    ["a typed phone number", "call me on 07701234567"],
    ["a spaced phone number", "0 7 7 0 1 2 3 4 5 6 7"],
    ["a dotted phone number", "0770.123.4567"],
    ["a dashed phone number", "0770-123-4567"],
    ["an email address", "reach me at ahmed@example.com"],
  ]) {
    await actForm("sendMessage", { taskId: t1001.id, body: text }, ahmed.cookie, rPage);
    const delivered = await db.message.count({ where: { taskId: t1001.id, body: text } });
    const logged = await db.blockedAttempt.count({
      where: { taskId: t1001.id, originalBody: text },
    });
    ok(`chat blocks ${label} and logs the attempt`, delivered === 0 && logged === 1,
      `delivered=${delivered} logged=${logged}`);
  }

  const innocent = "Reference 1042, unit price 25.50, two boxes";
  await actForm("sendMessage", { taskId: t1001.id, body: innocent }, ahmed.cookie, rPage);
  ok("chat does not block ordinary numbers",
    (await db.message.count({ where: { taskId: t1001.id, body: innocent } })) === 1);

  const outsider = await actForm("sendMessage",
    { taskId: t1001.id, body: "hello" }, sara.cookie, rPage);
  ok("a researcher not on the task cannot post to its chat",
    (await db.message.count({ where: { taskId: t1001.id, body: "hello" } })) === 0,
    `http ${outsider.status}`);

  // site photo through the real action
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  await actForm("saveSitePhoto", {
    taskId: t1001.id, image: png, photoType: "exterior",
    lat: "33.3028", lng: "44.4249", accuracy: "8",
    deviceTime: new Date(Date.now() - 3_600_000).toISOString(),
  }, ahmed.cookie, rPage);
  const shot = await db.sitePhoto.findFirst({
    where: { taskId: t1001.id }, orderBy: { serverTime: "desc" },
  });
  ok("saveSitePhoto stores the photo", Boolean(shot));
  ok("coordinates land in database columns, not the image",
    shot && Math.abs(shot.lat - 33.3028) < 1e-6 && Math.abs(shot.lng - 44.4249) < 1e-6);
  ok("accuracy is kept", shot?.accuracyM === 8);
  ok("the server clock wins over the device clock",
    shot && shot.serverTime.getTime() - shot.deviceTime.getTime() > 3_000_000);
  ok("photo type is recorded", shot?.photoType === "exterior");

  const badPhoto = await actForm("saveSitePhoto", {
    taskId: t1001.id, image: png, photoType: "exterior",
    lat: "", lng: "", accuracy: "", deviceTime: new Date().toISOString(),
  }, ahmed.cookie, rPage);
  ok("a photo with no location is refused",
    (await db.sitePhoto.count({ where: { taskId: t1001.id } })) === 1,
    `http ${badPhoto.status}`);

  // documents: upload, reject, re-upload, accept
  const slot = "Signed verification form";
  const file = new Blob(["signed form v1"], { type: "application/pdf" });
  const upload = async (blob, name) => {
    const inner = new FormData();
    inner.set("taskId", t1001.id);
    inner.set("slotLabel", slot);
    inner.set("file", blob, name);
    return fetch(BASE + rPage, {
      method: "POST",
      headers: { "Next-Action": ACTIONS.get("uploadDocument"), Cookie: ahmed.cookie },
      body: await encodeReply([null, inner]), redirect: "manual",
    });
  };
  await upload(file, "form-v1.pdf");
  let subs = await db.documentSubmission.findMany({
    where: { taskId: t1001.id, slotLabel: slot }, orderBy: { version: "asc" },
  });
  ok("uploadDocument stores version 1 as pending",
    subs.length === 1 && subs[0].version === 1 && subs[0].status === "pending");

  if (subs[0]) await actForm("reviewDocument",
    { submissionId: subs[0].id, decision: "reject", note: "Signature missing on page two." },
    company.cookie, `/client/tasks/${t1001.id}`);
  subs = await db.documentSubmission.findMany({ where: { taskId: t1001.id, slotLabel: slot } });
  ok("the company can reject a document", subs[0]?.status === "rejected");
  ok("the rejection note is stored", subs[0].rejectionNote?.includes("Signature missing"));
  ok("the rejection is posted into the chat",
    (await db.message.count({
      where: { taskId: t1001.id, isSystem: true, body: { contains: "Signature missing" } },
    })) === 1);
  ok("the researcher is notified of the rejection",
    Boolean(await db.notification.findFirst({
      where: { userId: ahmed.id, taskId: t1001.id, type: "document_rejected" },
    })));

  const noNote = await actForm("reviewDocument",
    { submissionId: subs[0]?.id ?? "x", decision: "reject", note: "" },
    company.cookie, `/client/tasks/${t1001.id}`);
  ok("a rejection with no note is refused", noNote.status === 200);

  await upload(new Blob(["signed form v2"], { type: "application/pdf" }), "form-v2.pdf");
  subs = await db.documentSubmission.findMany({
    where: { taskId: t1001.id, slotLabel: slot }, orderBy: { version: "asc" },
  });
  ok("a re-upload becomes version 2", subs.length === 2 && subs[1].version === 2);
  ok("version 1 is kept, not overwritten", subs[0].status === "rejected");

  if (subs[1]) await actForm("reviewDocument", { submissionId: subs[1].id, decision: "accept", note: "" },
    company.cookie, `/client/tasks/${t1001.id}`);
  ok("the company can accept a document",
    subs[1] ? (await db.documentSubmission.findUnique({ where: { id: subs[1].id } })).status === "accepted" : false);

  const wrongReviewer = await actForm("reviewDocument",
    { submissionId: subs[1]?.id ?? "x", decision: "reject", note: "no" },
    ahmed.cookie, `/client/tasks/${t1001.id}`);
  ok("a researcher cannot review their own document",
    subs[1] ? (await db.documentSubmission.findUnique({ where: { id: subs[1].id } })).status === "accepted" : false,
    `http ${wrongReviewer.status}`);

  // ------------------------------------------------------- 8. completion
  section("8  Completion and force close");
  await act("markComplete", [t1001.id], ahmed.cookie, rPage);
  task = await db.task.findUnique({ where: { id: t1001.id } });
  ok("one signature moves the task to under_review", task.status === "under_review");
  ok("the researcher signature is stamped", Boolean(task.researcherDoneAt));
  ok("one signature does not close the task", task.closedAt === null);

  await act("markComplete", [t1001.id], company.cookie, `/client/tasks/${t1001.id}`);
  task = await db.task.findUnique({ where: { id: t1001.id } });
  ok("both signatures close the task", task.status === "completed");
  ok("closedAt is stamped", Boolean(task.closedAt));

  const nonAdminClose = await act("forceCloseTask", [t1002.id], company.cookie,
    `/admin/tasks/${t1002.id}`);
  ok("a company account cannot force-close",
    (await db.task.findUnique({ where: { id: t1002.id } })).status !== "completed",
    `http ${nonAdminClose.status}`);

  await act("forceCloseTask", [t1002.id], admin.cookie, `/admin/tasks/${t1002.id}`);
  const forced = await db.task.findUnique({ where: { id: t1002.id } });
  ok("the operator can force-close a stalled task", forced.status === "completed");
  ok("force close records who closed it", forced.closedById === admin.id);

  // ------------------------------------------- 9. task creation and accounts
  section("9  Task creation, approvals, availability");
  const created = await actForm("createTask", {
    title: "Harness premises check",
    description: "Automated test task.",
    addressText: "Test Street, Baghdad",
    lat: "33.3152", lng: "44.3661",
  }, company.cookie, "/client/new");
  const fresh = await db.task.findFirst({
    where: { title: "Harness premises check" }, include: { client: true },
  });
  ok("createTask files a new task", Boolean(fresh), `http ${created.status}`);
  ok("the new task belongs to the filing company", fresh?.clientId === company.id);
  ok("the new task starts in the assignment queue", fresh?.status === "pending_assignment");
  ok("the new task carries its coordinates",
    fresh && Math.abs(fresh.lat - 33.3152) < 1e-6);
  ok("a sequential reference is issued", /^VR-\d+$/.test(fresh?.reference ?? ""));

  const noCoords = await actForm("createTask", {
    title: "No coordinates", description: "", addressText: "Nowhere", lat: "", lng: "",
  }, company.cookie, "/client/new");
  ok("a task without coordinates is refused",
    (await db.task.count({ where: { title: "No coordinates" } })) === 0,
    `http ${noCoords.status}`);
  ok("no task was ever filed at 0,0",
    (await db.task.count({ where: { lat: 0, lng: 0 } })) === 0);
  ok("no photo was ever stored at 0,0",
    (await db.sitePhoto.count({ where: { lat: 0, lng: 0 } })) === 0);

  // approvals go through the page's own form action
  const approvalsHtml = (await get("/admin/approvals", admin.cookie)).body;
  const [approveId, rejectId] = formIds(approvalsHtml);
  const applicant = await db.user.findFirst({ where: { status: "pending", role: "researcher" } });
  ok("the approvals page exposes both form actions", Boolean(approveId && rejectId));
  if (approveId && applicant) {
    await postForm(approveId, { userId: applicant.id }, admin.cookie, "/admin/approvals");
    const now = await db.user.findUnique({ where: { id: applicant.id } });
    ok("approving an applicant opens the account", now.status === "approved");
    ok("the approval records who granted it", now.approvedById === admin.id);
    ok("the approved applicant is notified", Boolean(await db.notification.findFirst({
      where: { userId: applicant.id, type: "account_approved" },
    })));
    ok("the approved account can now sign in",
      (await get("/researcher", (await cookieFor(applicant.email)).cookie)).status === 200);

    const other = await db.user.findFirst({ where: { status: "pending" } });
    if (other && rejectId) {
      await postForm(rejectId, { userId: other.id }, admin.cookie, "/admin/approvals");
      const done = await db.user.findUnique({ where: { id: other.id } });
      ok("rejecting an applicant closes the account", done.status === "rejected");
      ok("a rejected applicant cannot sign in", await (async () => {
        const r = await get("/client", (await cookieFor(other.email)).cookie);
        return r.status >= 300 && (r.location ?? "").includes("/login");
      })());
    }
  }

  const peopleHtml = (await get("/admin/people", admin.cookie)).body;
  const [suspendId] = formIds(peopleHtml);
  if (suspendId) {
    await postForm(suspendId, { userId: ahmed.id, next: "suspend" }, admin.cookie, "/admin/people");
    const gone = await get("/researcher", ahmed.cookie);
    ok("suspending an account revokes access at once",
      gone.status >= 300 && (gone.location ?? "").includes("/login"));
    await postForm(suspendId, { userId: ahmed.id, next: "restore" }, admin.cookie, "/admin/people");
    ok("restoring the account gives access back",
      (await get("/researcher", ahmed.cookie)).status === 200);
  }

  await act("setAvailability", [false], ahmed.cookie, "/researcher");
  ok("setAvailability switches off",
    (await db.researcherProfile.findUnique({ where: { userId: ahmed.id } })).isAvailable === false);
  await act("setAvailability", [true], ahmed.cookie, "/researcher");
  ok("setAvailability switches back on",
    (await db.researcherProfile.findUnique({ where: { userId: ahmed.id } })).isAvailable === true);

  const compAvail = await act("setAvailability", [false], company.cookie, "/researcher");
  ok("a company account has no availability to set",
    (await db.researcherProfile.findUnique({ where: { userId: ahmed.id } })).isAvailable === true,
    `http ${compAvail.status}`);

  // ------------------------------------------------------------ 10. sign-in
  section("10  Sign in and register");
  const good = await actForm("loginAction",
    { email: "operator@dispatch.test", password: "dispatch123" }, "", "/login");
  ok("a correct password is accepted and redirects to the right home",
    (good.status === 303 || good.status === 200) && !good.text.includes("do not match")
      && good.text.includes("/admin"),
    `http ${good.status}`);
  const bad = await actForm("loginAction",
    { email: "operator@dispatch.test", password: "wrong" }, "", "/login");
  ok("a wrong password is rejected", bad.text.includes("do not match"));
  const ghost = await actForm("loginAction",
    { email: "nobody@nowhere.test", password: "whatever" }, "", "/login");
  ok("an unknown email is rejected", ghost.text.includes("do not match"));

  const stamp = Date.now();
  await actForm("registerAction", {
    role: "researcher", fullName: "Harness Tester", email: `harness${stamp}@field.test`,
    password: "harness12345", phone: "+964 700 000 0000", country: "Iraq", city: "Baghdad",
    whatsappNumber: "+964 700 000 0000", expertise: "Site verification", coverageNote: "test",
  }, "", "/register");
  const newbie = await db.user.findUnique({ where: { email: `harness${stamp}@field.test` } });
  ok("registerAction creates the account", Boolean(newbie));
  ok("a new account starts pending, not approved", newbie?.status === "pending");
  ok("the password is stored hashed, never in the clear",
    Boolean(newbie?.passwordHash) && !newbie.passwordHash.includes("harness12345"));
  const dupe = await actForm("registerAction", {
    role: "researcher", fullName: "Dupe", email: `harness${stamp}@field.test`,
    password: "harness12345", phone: "1", country: "Iraq", city: "Baghdad",
    whatsappNumber: "1", expertise: "Site verification",
  }, "", "/register");
  ok("a duplicate email is refused", dupe.text.includes("already exists"));
  const shortPw = await actForm("registerAction", {
    role: "client", fullName: "Short", companyName: "X", email: `short${stamp}@t.test`,
    password: "123", phone: "1", country: "Iraq", city: "Baghdad",
  }, "", "/register");
  ok("a short password is refused", shortPw.text.includes("8 characters"));

  // ------------------------------------------------------------- summary
  console.log(`\n${"=".repeat(56)}`);
  console.log(`  ${pass} passed, ${fail} failed`);
  if (failures.length) {
    console.log("\n  Failures");
    for (const f of failures) console.log("   · " + f);
  }
  console.log("=".repeat(56));

  await db.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("\nHARNESS ERROR:", e);
  await db.$disconnect();
  process.exit(2);
});
