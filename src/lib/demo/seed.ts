import bcrypt from "bcryptjs";
import type { Store } from "./engine";

/**
 * The virtual data the demo starts with — the same people, tasks and history
 * as the archived database seed (archive/database-design/prisma/seed.mjs), so
 * every screen has something on it and the system is caught mid-flow.
 *
 * Seeded rows use fixed ids. Resetting the demo therefore keeps everyone
 * signed in and keeps task links working; only what happened since is undone.
 */

export const DEMO_PASSWORD = "dispatch123";

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const DEMO_IDS = {
  admin: uid(1),
  gulf: uid(2),
  north: uid(3),
  ahmed: uid(11),
  sara: uid(12),
  yusuf: uid(13),
  dilan: uid(14),
  noor: uid(15),
  kareem: uid(16),
  vr1001: uid(1001),
  vr1002: uid(1002),
  vr1003: uid(1003),
  vr1004: uid(1004),
  vr1005: uid(1005),
} as const;

// Real coordinates so the maps open somewhere sensible rather than in the sea.
const PLACES = {
  baghdadKarrada: { lat: 33.3028, lng: 44.4249 },
  baghdadMansour: { lat: 33.3128, lng: 44.3345 },
  basra: { lat: 30.5085, lng: 47.7804 },
  erbil: { lat: 36.1911, lng: 44.0092 },
  mosul: { lat: 36.335, lng: 43.1189 },
  najaf: { lat: 32.0289, lng: 44.3416 },
};

// bcrypt is deliberately slow. Hash once per server process, not per reset.
let passwordHash: string | undefined;

export function seedDemoData(store: Store): void {
  passwordHash ??= bcrypt.hashSync(DEMO_PASSWORD, 10);
  const now = Date.now();
  const minutesAgo = (m: number) => new Date(now - m * 60_000);
  const add = (model: string, data: Record<string, unknown>) => store.create(model, { data });
  const I = DEMO_IDS;

  // ----------------------------------------------------------------- people

  add("User", {
    id: I.admin,
    role: "admin",
    email: "operator@dispatch.test",
    passwordHash,
    fullName: "Mohamm",
    phone: "+964 770 000 0000",
    status: "approved",
    approvedAt: minutesAgo(10_000),
  });

  add("User", {
    id: I.gulf,
    role: "client",
    email: "ops@gulfverify.test",
    passwordHash,
    fullName: "Lina Farouk",
    phone: "+971 50 111 2222",
    status: "approved",
    approvedAt: minutesAgo(9_000),
    approvedById: I.admin,
    clientProfile: {
      create: {
        companyName: "Gulf Verify Ltd",
        contactPerson: "Lina Farouk",
        country: "United Arab Emirates",
        city: "Dubai",
      },
    },
  });

  add("User", {
    id: I.north,
    role: "client",
    email: "checks@northaudit.test",
    passwordHash,
    fullName: "Peter Rowe",
    phone: "+44 20 7946 0000",
    status: "pending", // waiting in the approvals queue
    createdAt: minutesAgo(180),
    clientProfile: {
      create: {
        companyName: "North Audit Partners",
        contactPerson: "Peter Rowe",
        country: "United Kingdom",
        city: "Manchester",
      },
    },
  });

  const researchers = [
    {
      id: I.ahmed,
      email: "ahmed@field.test",
      fullName: "Ahmed Kadhim",
      phone: "+964 771 234 5678",
      city: "Baghdad",
      place: PLACES.baghdadKarrada,
      expertise: "Site verification,Address verification,Document collection",
      available: true,
      seenMinutes: 4 as number | null,
      note: "Karrada, Karrada Dakhil, Jadriya. Travels to Mansour same day.",
    },
    {
      id: I.sara,
      email: "sara@field.test",
      fullName: "Sara Hassan",
      phone: "+964 772 345 6789",
      city: "Baghdad",
      place: PLACES.baghdadMansour,
      expertise: "Employment verification,Address verification",
      available: true,
      seenMinutes: 22,
      note: "Mansour and Yarmouk. Weekday mornings only.",
    },
    {
      id: I.yusuf,
      email: "yusuf@field.test",
      fullName: "Yusuf Mahmoud",
      phone: "+964 773 456 7890",
      city: "Basra",
      place: PLACES.basra,
      expertise: "Site verification,Asset inspection",
      available: true,
      seenMinutes: 61,
      note: "Basra city and the port road.",
    },
    {
      id: I.dilan,
      email: "dilan@field.test",
      fullName: "Dilan Barzan",
      phone: "+964 750 567 8901",
      city: "Erbil",
      place: PLACES.erbil,
      expertise: "Site verification,Asset inspection,Document collection",
      available: false,
      seenMinutes: 400,
      note: "Erbil and Duhok. Away this week.",
    },
    {
      id: I.noor,
      email: "noor@field.test",
      fullName: "Noor Al-Sabah",
      phone: "+964 774 678 9012",
      city: "Mosul",
      place: PLACES.mosul,
      expertise: "Address verification,Employment verification",
      available: false,
      seenMinutes: null, // never reported a position
      note: "Left bank of Mosul.",
    },
  ];

  for (const p of researchers) {
    const seen = p.seenMinutes !== null;
    add("User", {
      id: p.id,
      role: "researcher",
      email: p.email,
      passwordHash,
      fullName: p.fullName,
      phone: p.phone,
      status: "approved",
      approvedAt: minutesAgo(8_000),
      approvedById: I.admin,
      researcherProfile: {
        create: {
          whatsappNumber: p.phone,
          country: "Iraq",
          city: p.city,
          expertise: p.expertise,
          coverageNote: p.note,
          isAvailable: p.available,
          lastLat: seen ? p.place.lat : null,
          lastLng: seen ? p.place.lng : null,
          lastSeenAt: seen ? minutesAgo(p.seenMinutes as number) : null,
        },
      },
    });
  }

  // One researcher still waiting on approval, so the queue is not empty.
  add("User", {
    id: I.kareem,
    role: "researcher",
    email: "kareem@field.test",
    passwordHash,
    fullName: "Kareem Talib",
    phone: "+964 775 789 0123",
    status: "pending",
    createdAt: minutesAgo(120),
    researcherProfile: {
      create: {
        whatsappNumber: "+964 775 789 0123",
        country: "Iraq",
        city: "Najaf",
        expertise: "Site verification,Document collection",
        coverageNote: "Najaf and Kufa.",
      },
    },
  });

  // ------------------------------------------------------------------ tasks

  // 1 — sitting in the assignment queue.
  add("Task", {
    id: I.vr1001,
    reference: "VR-1001",
    clientId: I.gulf,
    title: "Business premises check",
    description:
      "Confirm the company trades at this address. Photograph the frontage and the interior, and have the form signed by whoever is in charge on the day.",
    addressText: "Al-Karrada Dakhil, near Babil Cinema, Baghdad",
    ...PLACES.baghdadKarrada,
    status: "pending_assignment",
    createdAt: minutesAgo(22),
  });

  // 2 — offer out, waiting on an answer.
  add("Task", {
    id: I.vr1002,
    reference: "VR-1002",
    clientId: I.gulf,
    title: "Residential address confirmation",
    description: "Confirm the subject resides here and photograph the entrance.",
    addressText: "60m Street, Erbil",
    ...PLACES.erbil,
    status: "offered",
    createdAt: minutesAgo(95),
  });
  add("TaskOffer", {
    taskId: I.vr1002,
    researcherId: I.sara,
    sentAt: minutesAgo(40),
    waMessageId: `dryrun-seed-${I.vr1002}`,
    response: "pending",
    dryRun: true,
  });

  // 3 — in progress, one declined offer in the history, and a live chat.
  add("Task", {
    id: I.vr1003,
    reference: "VR-1003",
    clientId: I.gulf,
    title: "Warehouse existence check",
    description:
      "Verify the warehouse exists and is operating. Outside and inside photos, plus the signed form.",
    addressText: "Al-Jazair Street, Basra",
    ...PLACES.basra,
    status: "in_progress",
    assignedResearcherId: I.yusuf,
    createdAt: minutesAgo(320),
    startedAt: minutesAgo(90),
  });
  store.createMany("TaskOffer", {
    data: [
      {
        taskId: I.vr1003,
        researcherId: I.ahmed,
        sentAt: minutesAgo(300),
        waMessageId: `dryrun-seed-${I.vr1003}-a`,
        response: "declined",
        respondedAt: minutesAgo(290),
        dryRun: true,
      },
      {
        taskId: I.vr1003,
        researcherId: I.yusuf,
        sentAt: minutesAgo(280),
        waMessageId: `dryrun-seed-${I.vr1003}-b`,
        response: "accepted",
        respondedAt: minutesAgo(275),
        dryRun: true,
      },
    ],
  });
  store.createMany("Message", {
    data: [
      {
        taskId: I.vr1003,
        senderId: I.yusuf,
        isSystem: true,
        body: "The researcher has started work. This channel is now open.",
        createdAt: minutesAgo(90),
      },
      {
        taskId: I.vr1003,
        senderId: I.yusuf,
        body: "I am at the gate. The manager is here and will sign.",
        createdAt: minutesAgo(70),
      },
      {
        taskId: I.vr1003,
        senderId: I.gulf,
        body: "Good. Please get the loading bay in one of the interior shots.",
        createdAt: minutesAgo(64),
      },
    ],
  });
  add("BlockedAttempt", {
    taskId: I.vr1003,
    senderId: I.yusuf,
    originalBody: "Easier if you call me on 0770 123 4567",
    matchedRule: "phone",
    createdAt: minutesAgo(60),
  });

  // 4 — under review.
  add("Task", {
    id: I.vr1004,
    reference: "VR-1004",
    clientId: I.gulf,
    title: "Employer verification",
    description: "Confirm the subject is employed here and collect a signed form.",
    addressText: "Mansour District, Baghdad",
    ...PLACES.baghdadMansour,
    status: "under_review",
    assignedResearcherId: I.ahmed,
    createdAt: minutesAgo(1500),
    startedAt: minutesAgo(1400),
    researcherDoneAt: minutesAgo(1200),
  });
  add("TaskOffer", {
    taskId: I.vr1004,
    researcherId: I.ahmed,
    sentAt: minutesAgo(1480),
    waMessageId: `dryrun-seed-${I.vr1004}`,
    response: "accepted",
    respondedAt: minutesAgo(1470),
    dryRun: true,
  });

  // 5 — closed, for the completed tab.
  add("Task", {
    id: I.vr1005,
    reference: "VR-1005",
    clientId: I.gulf,
    title: "Shop frontage verification",
    description: "Photograph the frontage and confirm the trading name on the sign.",
    addressText: "Al-Sahla Street, Najaf",
    ...PLACES.najaf,
    status: "completed",
    assignedResearcherId: I.ahmed,
    createdAt: minutesAgo(4000),
    startedAt: minutesAgo(3900),
    researcherDoneAt: minutesAgo(3700),
    clientDoneAt: minutesAgo(3600),
    closedAt: minutesAgo(3600),
  });

  add("Notification", {
    userId: I.gulf,
    taskId: I.vr1003,
    type: "researcher_assigned",
    body: "A researcher has been assigned to VR-1003.",
    createdAt: minutesAgo(275),
  });
}
