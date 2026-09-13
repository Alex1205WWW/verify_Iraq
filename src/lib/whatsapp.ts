import "server-only";

/**
 * WhatsApp Cloud API adapter for task offers.
 *
 * Assignment messages always reach a researcher outside the 24-hour customer
 * service window, so they must go out as a pre-approved template. The template
 * carries two quick-reply buttons; when the researcher taps one, Meta calls the
 * webhook at /api/webhooks/whatsapp and we match the reply back to the offer by
 * the message id stored when we sent it.
 *
 * With no credentials configured the adapter runs in DRY RUN: nothing leaves
 * the server, the offer is written exactly as it would be, and the admin can
 * simulate the researcher's answer from the task screen. That keeps the whole
 * flow testable before Meta onboarding is finished.
 */

export type SendResult = {
  dryRun: boolean;
  messageId: string;
  error?: string;
};

export function whatsappConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN,
  );
}

export const ACCEPT_PAYLOAD = "OFFER_ACCEPT";
export const DECLINE_PAYLOAD = "OFFER_DECLINE";

type OfferMessage = {
  toNumber: string;
  researcherName: string;
  reference: string;
  addressText: string;
};

export async function sendOffer(msg: OfferMessage): Promise<SendResult> {
  const body =
    `New verification task ${msg.reference}\n` +
    `${msg.addressText}\n` +
    `Reply Accept to take it, or Decline.`;

  if (!whatsappConfigured()) {
    console.info(
      `[whatsapp:dry-run] -> ${msg.toNumber} (${msg.researcherName})\n${body}`,
    );
    return { dryRun: true, messageId: `dryrun-${crypto.randomUUID()}` };
  }

  const url = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: msg.toNumber,
        type: "template",
        template: {
          name: process.env.WHATSAPP_TEMPLATE_NAME || "task_offer",
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "en" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: msg.researcherName },
                { type: "text", text: msg.reference },
                { type: "text", text: msg.addressText },
              ],
            },
            {
              type: "button",
              sub_type: "quick_reply",
              index: "0",
              parameters: [{ type: "payload", payload: ACCEPT_PAYLOAD }],
            },
            {
              type: "button",
              sub_type: "quick_reply",
              index: "1",
              parameters: [{ type: "payload", payload: DECLINE_PAYLOAD }],
            },
          ],
        },
      }),
    });

    const json = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message?: string };
    };

    if (!res.ok) {
      return {
        dryRun: false,
        messageId: `failed-${crypto.randomUUID()}`,
        error: json.error?.message ?? `Meta returned ${res.status}`,
      };
    }

    return { dryRun: false, messageId: json.messages?.[0]?.id ?? "" };
  } catch (err) {
    return {
      dryRun: false,
      messageId: `failed-${crypto.randomUUID()}`,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}
