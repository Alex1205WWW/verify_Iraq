import { field as f, relation as r, type Schema } from "./engine";

/**
 * The data model, transcribed from archive/database-design/prisma/schema.prisma.
 * Same tables, same columns, same defaults, same unique rules and the same
 * relation names, so every query written against Prisma reads the same here.
 */
export const schema: Schema = {
  User: {
    fields: {
      id: f.id,
      role: f.required,
      email: f.required,
      passwordHash: f.required,
      fullName: f.required,
      phone: f.required,
      status: f.value("pending"),
      createdAt: f.now,
      approvedAt: f.optional,
      approvedById: f.optional,
    },
    unique: [["id"], ["email"]],
    relations: {
      approvedBy: r.one("User", "approvedById", "id"),
      approved: r.many("User", "approvedById"),
      clientProfile: r.one("ClientProfile", "id", "userId"),
      researcherProfile: r.one("ResearcherProfile", "id", "userId"),
      tasksFiled: r.many("Task", "clientId"),
      tasksAssigned: r.many("Task", "assignedResearcherId"),
      tasksClosed: r.many("Task", "closedById"),
      offers: r.many("TaskOffer", "researcherId"),
      attachments: r.many("TaskAttachment", "uploadedById"),
      photos: r.many("SitePhoto", "capturedById"),
      docsUploaded: r.many("DocumentSubmission", "uploadedById"),
      docsReviewed: r.many("DocumentSubmission", "reviewedById"),
      messages: r.many("Message", "senderId"),
      blockedAttempts: r.many("BlockedAttempt", "senderId"),
      notifications: r.many("Notification", "userId"),
    },
  },

  ClientProfile: {
    fields: {
      userId: f.required,
      companyName: f.required,
      contactPerson: f.required,
      country: f.required,
      city: f.required,
    },
    unique: [["userId"]],
    relations: { user: r.one("User", "userId", "id") },
  },

  ResearcherProfile: {
    fields: {
      userId: f.required,
      whatsappNumber: f.required,
      country: f.required,
      city: f.required,
      expertise: f.value(""),
      coverageNote: f.value(""),
      isAvailable: f.value(false),
      lastLat: f.optional,
      lastLng: f.optional,
      lastSeenAt: f.optional,
    },
    unique: [["userId"]],
    relations: { user: r.one("User", "userId", "id") },
  },

  Task: {
    fields: {
      id: f.id,
      reference: f.required,
      clientId: f.required,
      title: f.required,
      description: f.value(""),
      addressText: f.required,
      lat: f.required,
      lng: f.required,
      status: f.value("pending_assignment"),
      assignedResearcherId: f.optional,
      createdAt: f.now,
      startedAt: f.optional,
      researcherDoneAt: f.optional,
      clientDoneAt: f.optional,
      closedAt: f.optional,
      closedById: f.optional,
    },
    unique: [["id"], ["reference"]],
    relations: {
      client: r.one("User", "clientId", "id"),
      assignedResearcher: r.one("User", "assignedResearcherId", "id"),
      closedBy: r.one("User", "closedById", "id"),
      offers: r.many("TaskOffer", "taskId"),
      attachments: r.many("TaskAttachment", "taskId"),
      photos: r.many("SitePhoto", "taskId"),
      documents: r.many("DocumentSubmission", "taskId"),
      messages: r.many("Message", "taskId"),
      blocked: r.many("BlockedAttempt", "taskId"),
      notifications: r.many("Notification", "taskId"),
    },
  },

  TaskOffer: {
    fields: {
      id: f.id,
      taskId: f.required,
      researcherId: f.required,
      sentAt: f.now,
      waMessageId: f.optional,
      response: f.value("pending"),
      respondedAt: f.optional,
      dryRun: f.value(true),
    },
    unique: [["id"]],
    relations: {
      task: r.one("Task", "taskId", "id"),
      researcher: r.one("User", "researcherId", "id"),
    },
  },

  TaskAttachment: {
    fields: {
      id: f.id,
      taskId: f.required,
      uploadedById: f.required,
      fileName: f.required,
      mimeType: f.required,
      sizeBytes: f.required,
      storageKey: f.required,
      createdAt: f.now,
    },
    unique: [["id"]],
    relations: {
      task: r.one("Task", "taskId", "id"),
      uploadedBy: r.one("User", "uploadedById", "id"),
    },
  },

  SitePhoto: {
    fields: {
      id: f.id,
      taskId: f.required,
      capturedById: f.required,
      photoType: f.required,
      storageKey: f.required,
      lat: f.required,
      lng: f.required,
      accuracyM: f.required,
      deviceTime: f.required,
      serverTime: f.now,
      isMockLocation: f.optional,
    },
    unique: [["id"]],
    relations: {
      task: r.one("Task", "taskId", "id"),
      capturedBy: r.one("User", "capturedById", "id"),
    },
  },

  DocumentSubmission: {
    fields: {
      id: f.id,
      taskId: f.required,
      slotLabel: f.required,
      version: f.required,
      storageKey: f.required,
      fileName: f.required,
      uploadedById: f.required,
      status: f.value("pending"),
      reviewedById: f.optional,
      reviewedAt: f.optional,
      rejectionNote: f.optional,
      createdAt: f.now,
    },
    unique: [["id"], ["taskId", "slotLabel", "version"]],
    relations: {
      task: r.one("Task", "taskId", "id"),
      uploadedBy: r.one("User", "uploadedById", "id"),
      reviewedBy: r.one("User", "reviewedById", "id"),
    },
  },

  Message: {
    fields: {
      id: f.id,
      taskId: f.required,
      senderId: f.required,
      body: f.required,
      isSystem: f.value(false),
      createdAt: f.now,
    },
    unique: [["id"]],
    relations: {
      task: r.one("Task", "taskId", "id"),
      sender: r.one("User", "senderId", "id"),
    },
  },

  BlockedAttempt: {
    fields: {
      id: f.id,
      taskId: f.required,
      senderId: f.required,
      originalBody: f.required,
      matchedRule: f.required,
      createdAt: f.now,
    },
    unique: [["id"]],
    relations: {
      task: r.one("Task", "taskId", "id"),
      sender: r.one("User", "senderId", "id"),
    },
  },

  Notification: {
    fields: {
      id: f.id,
      userId: f.required,
      taskId: f.optional,
      type: f.required,
      body: f.required,
      readAt: f.optional,
      createdAt: f.now,
    },
    unique: [["id"]],
    relations: {
      user: r.one("User", "userId", "id"),
      task: r.one("Task", "taskId", "id"),
    },
  },
};

// ------------------------------------------------------------------ types
//
// Relations are typed as present. At runtime a relation is only there when
// the query included it — the same contract Prisma enforces — and every query
// in the app was written and type-checked against Prisma first.

type Count = Record<string, number>;

export interface User {
  id: string;
  role: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone: string;
  status: string;
  createdAt: Date;
  approvedAt: Date | null;
  approvedById: string | null;
  approvedBy: User | null;
  approved: User[];
  clientProfile: ClientProfile | null;
  researcherProfile: ResearcherProfile | null;
  tasksFiled: Task[];
  tasksAssigned: Task[];
  tasksClosed: Task[];
  offers: TaskOffer[];
  attachments: TaskAttachment[];
  photos: SitePhoto[];
  docsUploaded: DocumentSubmission[];
  docsReviewed: DocumentSubmission[];
  messages: Message[];
  blockedAttempts: BlockedAttempt[];
  notifications: Notification[];
  _count: Count;
}

export interface ClientProfile {
  userId: string;
  companyName: string;
  contactPerson: string;
  country: string;
  city: string;
  user: User;
}

export interface ResearcherProfile {
  userId: string;
  whatsappNumber: string;
  country: string;
  city: string;
  expertise: string;
  coverageNote: string;
  isAvailable: boolean;
  lastLat: number | null;
  lastLng: number | null;
  lastSeenAt: Date | null;
  user: User;
}

export interface Task {
  id: string;
  reference: string;
  clientId: string;
  title: string;
  description: string;
  addressText: string;
  lat: number;
  lng: number;
  status: string;
  assignedResearcherId: string | null;
  createdAt: Date;
  startedAt: Date | null;
  researcherDoneAt: Date | null;
  clientDoneAt: Date | null;
  closedAt: Date | null;
  closedById: string | null;
  client: User;
  assignedResearcher: User | null;
  closedBy: User | null;
  offers: TaskOffer[];
  attachments: TaskAttachment[];
  photos: SitePhoto[];
  documents: DocumentSubmission[];
  messages: Message[];
  blocked: BlockedAttempt[];
  notifications: Notification[];
  _count: Count;
}

export interface TaskOffer {
  id: string;
  taskId: string;
  researcherId: string;
  sentAt: Date;
  waMessageId: string | null;
  response: string;
  respondedAt: Date | null;
  dryRun: boolean;
  task: Task;
  researcher: User;
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  uploadedById: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  createdAt: Date;
  task: Task;
  uploadedBy: User;
}

export interface SitePhoto {
  id: string;
  taskId: string;
  capturedById: string;
  photoType: string;
  storageKey: string;
  lat: number;
  lng: number;
  accuracyM: number;
  deviceTime: Date;
  serverTime: Date;
  isMockLocation: boolean | null;
  task: Task;
  capturedBy: User;
}

export interface DocumentSubmission {
  id: string;
  taskId: string;
  slotLabel: string;
  version: number;
  storageKey: string;
  fileName: string;
  uploadedById: string;
  status: string;
  reviewedById: string | null;
  reviewedAt: Date | null;
  rejectionNote: string | null;
  createdAt: Date;
  task: Task;
  uploadedBy: User;
  reviewedBy: User | null;
}

export interface Message {
  id: string;
  taskId: string;
  senderId: string;
  body: string;
  isSystem: boolean;
  createdAt: Date;
  task: Task;
  sender: User;
}

export interface BlockedAttempt {
  id: string;
  taskId: string;
  senderId: string;
  originalBody: string;
  matchedRule: string;
  createdAt: Date;
  task: Task;
  sender: User;
}

export interface Notification {
  id: string;
  userId: string;
  taskId: string | null;
  type: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
  user: User;
  task: Task | null;
}

type Shape = Record<string, unknown>;
type Where = Record<string, unknown>;

export interface FindArgs {
  where?: Where;
  include?: Shape;
  select?: Shape;
  orderBy?: Shape | Shape[];
  take?: number;
  skip?: number;
}

type WriteArgs = { data: Shape; include?: Shape; select?: Shape };

export interface Delegate<T> {
  findUnique(args: FindArgs & { where: Where }): Promise<T | null>;
  findUniqueOrThrow(args: FindArgs & { where: Where }): Promise<T>;
  findFirst(args?: FindArgs): Promise<T | null>;
  findFirstOrThrow(args?: FindArgs): Promise<T>;
  findMany(args?: FindArgs): Promise<T[]>;
  count(args?: { where?: Where }): Promise<number>;
  groupBy<K extends keyof T>(args: {
    by: K[];
    where?: Where;
    _count?: Shape | true;
    orderBy?: Shape | Shape[];
  }): Promise<Array<Pick<T, K> & { _count: Count & { _all: number } }>>;
  create(args: WriteArgs): Promise<T>;
  createMany(args: { data: Shape | Shape[] }): Promise<{ count: number }>;
  update(args: WriteArgs & { where: Where }): Promise<T>;
  updateMany(args: { where?: Where; data: Shape }): Promise<{ count: number }>;
  delete(args: { where: Where; include?: Shape; select?: Shape }): Promise<T>;
  deleteMany(args?: { where?: Where }): Promise<{ count: number }>;
}

export interface DemoClient {
  user: Delegate<User>;
  clientProfile: Delegate<ClientProfile>;
  researcherProfile: Delegate<ResearcherProfile>;
  task: Delegate<Task>;
  taskOffer: Delegate<TaskOffer>;
  taskAttachment: Delegate<TaskAttachment>;
  sitePhoto: Delegate<SitePhoto>;
  documentSubmission: Delegate<DocumentSubmission>;
  message: Delegate<Message>;
  blockedAttempt: Delegate<BlockedAttempt>;
  notification: Delegate<Notification>;
  $transaction<T>(arg: Promise<T>[] | ((client: DemoClient) => Promise<T>)): Promise<T | T[]>;
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
}
