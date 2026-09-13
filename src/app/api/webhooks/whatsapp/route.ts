import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveOffer } from "@/actions/admin";
import { ACCEPT_PAYLOAD } from "@/lib/whatsapp";

/**
 * Meta calls this URL when a researcher taps Accept or Decline on the offer
 * template. The button reply carries the payload we set when sending, and the
 * context message id points back at the message we sent — which is how the
 * reply is matched to the right offer row.
 */

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Verification failed", { status: 403 });
}

type ButtonMessage = {
  context?: { id?: string };
  button?: { payload?: string; text?: string };
  interactive?: { button_reply?: { id?: string; title?: string } };
};

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const entries =
    (payload as { entry?: { changes?: { value?: { messages?: ButtonMessage[] } }[] }[] })
      .entry ?? [];

  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        const repliedTo = message.context?.id;
        if (!repliedTo) continue;

        const answer =
          message.button?.payload ??
          message.interactive?.button_reply?.id ??
          message.button?.text ??
          message.interactive?.button_reply?.title ??
          "";

        const offer = await db.taskOffer.findFirst({
          where: { waMessageId: repliedTo, response: "pending" },
        });
        if (!offer) continue;

        const accepted = answer.toUpperCase().includes("ACCEPT");
        await resolveOffer(offer.id, accepted);
      }
    }
  }

  // Meta retries anything that is not a 200, so always acknowledge.
  return NextResponse.json({ ok: true });
}
