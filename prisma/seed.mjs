import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const PASSWORD = "dispatch123";

// Real coordinates so the maps open somewhere sensible rather than in the sea.
const PLACES = {
  baghdadKarrada: { lat: 33.3028, lng: 44.4249 },
  baghdadMansour: { lat: 33.3128, lng: 44.3345 },
  basra: { lat: 30.5085, lng: 47.7804 },
  erbil: { lat: 36.1911, lng: 44.0092 },
  mosul: { lat: 36.335, lng: 43.1189 },
  najaf: { lat: 32.0289, lng: 44.3416 },
};

async function main() {
  console.log("Clearing existing rows…");
  await db.notification.deleteMany();
  await db.blockedAttempt.deleteMany();
  await db.message.deleteMany();
  await db.documentSubmission.deleteMany();
  await db.sitePhoto.deleteMany();
  await db.taskAttachment.deleteMany();
  await db.taskOffer.deleteMany();
  await db.task.deleteMany();
  await db.clientProfile.deleteMany();
  await db.researcherProfile.deleteMany();
  await db.user.deleteMany();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const now = Date.now();
  const minutesAgo = (m) => new Date(now - m * 60_000);

  console.log("Creating people…");

  const admin = await db.user.create({
    data: {
      role: "admin",
      email: "operator@dispatch.test",
      passwordHash,
      fullName: "Mohamm",
      phone: "+964 770 000 0000",
      status: "approved",
      approvedAt: new Date(),
    },
  });

  const gulf = await db.user.create({
    data: {
      role: "client",
      email: "ops@gulfverify.test",
      passwordHash,
      fullName: "Lina Farouk",
      phone: "+971 50 111 2222",
      status: "approved",
      approvedAt: new Date(),
      approvedById: admin.id,
      clientProfile: {
        create: {
          companyName: "Gulf Verify Ltd",
          contactPerson: "Lina Farouk",
          country: "United Arab Emirates",
          city: "Dubai",
        },
      },
    },
  });

  await db.user.create({
    data: {
      role: "client",
      email: "checks@northaudit.test",
      passwordHash,
      fullName: "Peter Rowe",
      phone: "+44 20 7946 0000",
      status: "pending", // waiting in the approvals queue
      clientProfile: {
        create: {
          companyName: "North Audit Partners",
          contactPerson: "Peter Rowe",
          country: "United Kingdom",
          city: "Manchester",
        },
      },
    },
  });

  const researcherSeed = [
    {
      email: "ahmed@field.test",
      fullName: "Ahmed Kadhim",
      phone: "+964 771 234 5678",
      city: "Baghdad",
      place: PLACES.baghdadKarrada,
      expertise: "Site verification,Address verification,Document collection",
      available: true,
      seenMinutes: 4,
      note: "Karrada, Karrada Dakhil, Jadriya. Travels to Mansour same day.",
    },
    {
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

  const researchers = [];
  for (const r of researcherSeed) {
    researchers.push(
      await db.user.create({
        data: {
          role: "researcher",
          email: r.email,
          passwordHash,
          fullName: r.fullName,
          phone: r.phone,
          status: "approved",
          approvedAt: new Date(),
          approvedById: admin.id,
          researcherProfile: {
            create: {
              whatsappNumber: r.phone,
              country: "Iraq",
              city: r.city,
              expertise: r.expertise,
              coverageNote: r.note,
              isAvailable: r.available,
              lastLat: r.seenMinutes === null ? null : r.place.lat,
              lastLng: r.seenMinutes === null ? null : r.place.lng,
              lastSeenAt: r.seenMinutes === null ? null : minutesAgo(r.seenMinutes),
            },
          },
        },
      }),
    );
  }

  // One researcher still waiting on approval, so the queue is not empty.
  await db.user.create({
    data: {
      role: "researcher",
      email: "kareem@field.test",
      passwordHash,
      fullName: "Kareem Talib",
      phone: "+964 775 789 0123",
      status: "pending",
      researcherProfile: {
        create: {
          whatsappNumber: "+964 775 789 0123",
          country: "Iraq",
          city: "Najaf",
          expertise: "Site verification,Document collection",
          coverageNote: "Najaf and Kufa.",
        },
      },
    },
  });

  const [ahmed, sara, yusuf] = researchers;

  console.log("Creating tasks…");

  // 1 — sitting in the assignment queue.
  await db.task.create({
    data: {
      reference: "VR-1001",
      clientId: gulf.id,
      title: "Business premises check",
      description:
        "Confirm the company trades at this address. Photograph the frontage and the interior, and have the form signed by whoever is in charge on the day.",
      addressText: "Al-Karrada Dakhil, near Babil Cinema, Baghdad",
      lat: PLACES.baghdadKarrada.lat,
      lng: PLACES.baghdadKarrada.lng,
      status: "pending_assignment",
      createdAt: minutesAgo(22),
    },
  });

  // 2 — offer out, waiting on an answer.
  const offered = await db.task.create({
    data: {
      reference: "VR-1002",
      clientId: gulf.id,
      title: "Residential address confirmation",
      description: "Confirm the subject resides here and photograph the entrance.",
      addressText: "60m Street, Erbil",
      lat: PLACES.erbil.lat,
      lng: PLACES.erbil.lng,
      status: "offered",
      createdAt: minutesAgo(95),
    },
  });
  await db.taskOffer.create({
    data: {
      taskId: offered.id,
      researcherId: sara.id,
      sentAt: minutesAgo(40),
      waMessageId: `dryrun-seed-${offered.id}`,
      response: "pending",
      dryRun: true,
    },
  });

  // 3 — in progress, one declined offer in the history, photos and chat.
  const working = await db.task.create({
    data: {
      reference: "VR-1003",
      clientId: gulf.id,
      title: "Warehouse existence check",
      description:
        "Verify the warehouse exists and is operating. Outside and inside photos, plus the signed form.",
      addressText: "Al-Jazair Street, Basra",
      lat: PLACES.basra.lat,
      lng: PLACES.basra.lng,
      status: "in_progress",
      assignedResearcherId: yusuf.id,
      createdAt: minutesAgo(320),
      startedAt: minutesAgo(90),
    },
  });
  await db.taskOffer.createMany({
    data: [
      {
        taskId: working.id,
        researcherId: ahmed.id,
        sentAt: minutesAgo(300),
        waMessageId: `dryrun-seed-${working.id}-a`,
        response: "declined",
        respondedAt: minutesAgo(290),
        dryRun: true,
      },
      {
        taskId: working.id,
        researcherId: yusuf.id,
        sentAt: minutesAgo(280),
        waMessageId: `dryrun-seed-${working.id}-b`,
        response: "accepted",
        respondedAt: minutesAgo(275),
        dryRun: true,
      },
    ],
  });
  await db.message.createMany({
    data: [
      {
        taskId: working.id,
        senderId: yusuf.id,
        isSystem: true,
        body: "The researcher has started work. This channel is now open.",
        createdAt: minutesAgo(90),
      },
      {
        taskId: working.id,
        senderId: yusuf.id,
        body: "I am at the gate. The manager is here and will sign.",
        createdAt: minutesAgo(70),
      },
      {
        taskId: working.id,
        senderId: gulf.id,
        body: "Good. Please get the loading bay in one of the interior shots.",
        createdAt: minutesAgo(64),
      },
    ],
  });
  await db.blockedAttempt.create({
    data: {
      taskId: working.id,
      senderId: yusuf.id,
      originalBody: "Easier if you call me on 0770 123 4567",
      matchedRule: "phone",
      createdAt: minutesAgo(60),
    },
  });

  // 4 — under review, one document sent back.
  const review = await db.task.create({
    data: {
      reference: "VR-1004",
      clientId: gulf.id,
      title: "Employer verification",
      description: "Confirm the subject is employed here and collect a signed form.",
      addressText: "Mansour District, Baghdad",
      lat: PLACES.baghdadMansour.lat,
      lng: PLACES.baghdadMansour.lng,
      status: "under_review",
      assignedResearcherId: ahmed.id,
      createdAt: minutesAgo(1500),
      startedAt: minutesAgo(1400),
      researcherDoneAt: minutesAgo(1200),
    },
  });
  await db.taskOffer.create({
    data: {
      taskId: review.id,
      researcherId: ahmed.id,
      sentAt: minutesAgo(1480),
      waMessageId: `dryrun-seed-${review.id}`,
      response: "accepted",
      respondedAt: minutesAgo(1470),
      dryRun: true,
    },
  });

  // 5 — closed, for the completed tab.
  await db.task.create({
    data: {
      reference: "VR-1005",
      clientId: gulf.id,
      title: "Shop frontage verification",
      description: "Photograph the frontage and confirm the trading name on the sign.",
      addressText: "Al-Sahla Street, Najaf",
      lat: PLACES.najaf.lat,
      lng: PLACES.najaf.lng,
      status: "completed",
      assignedResearcherId: ahmed.id,
      createdAt: minutesAgo(4000),
      startedAt: minutesAgo(3900),
      researcherDoneAt: minutesAgo(3700),
      clientDoneAt: minutesAgo(3600),
      closedAt: minutesAgo(3600),
    },
  });

  await db.notification.create({
    data: {
      userId: gulf.id,
      taskId: working.id,
      type: "researcher_assigned",
      body: "A researcher has been assigned to VR-1003.",
      createdAt: minutesAgo(275),
    },
  });

  console.log(`
Seed complete.

  Operator    operator@dispatch.test
  Company     ops@gulfverify.test
  Researcher  ahmed@field.test   (also sara@, yusuf@, dilan@, noor@)

  Password for all accounts: ${PASSWORD}

  Waiting in the approvals queue: North Audit Partners, Kareem Talib.
  VR-1001 needs a researcher. VR-1002 has an offer out to Sara.
`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
