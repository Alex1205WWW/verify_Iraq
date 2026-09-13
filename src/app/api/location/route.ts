import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";

/**
 * Position ping from the researcher's browser.
 *
 * The browser sends this on a distance threshold rather than a timer — see
 * LocationPinger. A browser cannot report a position while the tab is closed,
 * which is the honest limit of the web MVP and the reason a native researcher
 * app is phase two.
 */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user || user.role !== "researcher") {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  let body: { lat?: unknown; lng?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Bad coordinates" }, { status: 400 });
  }

  await db.researcherProfile.update({
    where: { userId: user.id },
    data: { lastLat: lat, lastLng: lng, lastSeenAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
