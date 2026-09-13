import type { BlockRule } from "./types";

/**
 * Contact-detail filter for task chat.
 *
 * This is deliberately honest about its own limits. It catches the ordinary
 * cases — a typed number, a number spaced or dotted out, an email address —
 * and it will not catch a number spelled in words or photographed on a card.
 * That is why every catch is logged rather than silently dropped: the log is
 * what tells Mohamm who keeps trying to go around him.
 */

const EMAIL = /[A-Z0-9._%+-]+\s*(?:@|\(at\)|\[at\])\s*[A-Z0-9.-]+\s*\.\s*[A-Z]{2,}/i;

/** Digits with any amount of separator noise between them. */
const SEPARATORS = /[\s._\-()+/\\|,·•*]+/g;

export type FilterResult =
  | { blocked: false; body: string }
  | { blocked: true; rule: BlockRule; reason: string };

export function screenMessage(raw: string): FilterResult {
  const body = raw.trim();

  if (EMAIL.test(body)) {
    return {
      blocked: true,
      rule: "email",
      reason: "That looks like an email address. Keep the conversation here.",
    };
  }

  // Strip separators, then look for any run of 7+ digits. Seven is the
  // shortest thing that is realistically a phone number rather than a
  // reference, a price or a date.
  const stripped = body.replace(SEPARATORS, "");
  if (/\d{7,}/.test(stripped)) {
    return {
      blocked: true,
      rule: "phone",
      reason: "That looks like a phone number. Keep the conversation here.",
    };
  }

  return { blocked: false, body };
}
