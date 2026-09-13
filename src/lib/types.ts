// SQLite has no enum type, so these unions are the contract. Each one matches
// a text column in prisma/schema.prisma. Moving to Postgres later means
// turning these into real DB enums without changing any calling code.

export const ROLES = ["admin", "client", "researcher"] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ["pending", "approved", "rejected"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const TASK_STATUSES = [
  "pending_assignment",
  "offered",
  "assigned",
  "in_progress",
  "under_review",
  "completed",
  "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const OFFER_RESPONSES = ["pending", "accepted", "declined"] as const;
export type OfferResponse = (typeof OFFER_RESPONSES)[number];

export const DOC_STATUSES = ["pending", "accepted", "rejected"] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

export const PHOTO_TYPES = ["exterior", "interior"] as const;
export type PhotoType = (typeof PHOTO_TYPES)[number];

export const BLOCK_RULES = ["phone", "email"] as const;
export type BlockRule = (typeof BLOCK_RULES)[number];

export const NOTIFICATION_TYPES = [
  "account_approved",
  "researcher_assigned",
  "document_rejected",
  "task_closed",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Specialisms a researcher can be filtered by on the dispatch map. */
export const EXPERTISE = [
  "Site verification",
  "Address verification",
  "Employment verification",
  "Asset inspection",
  "Document collection",
] as const;
export type Expertise = (typeof EXPERTISE)[number];

/** The document slots every task starts with. Mohamm's standard set. */
export const DEFAULT_DOC_SLOTS = [
  "Signed verification form",
  "Site licence or permit",
  "ID of the signatory",
] as const;

/** Human labels for task statuses, used everywhere in the interface. */
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pending_assignment: "Finding a researcher",
  offered: "Offer sent",
  assigned: "Assigned",
  in_progress: "In progress",
  under_review: "Under review",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Which visual tone a status carries. Drives the pill colour. */
export const TASK_STATUS_TONE: Record<TaskStatus, string> = {
  pending_assignment: "wait",
  offered: "warn",
  assigned: "info",
  in_progress: "info",
  under_review: "warn",
  completed: "ok",
  cancelled: "bad",
};

export function isTaskStatus(v: string): v is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(v);
}
