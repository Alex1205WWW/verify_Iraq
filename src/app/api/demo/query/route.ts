import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const READS = new Set(["findUnique", "findFirst", "findMany", "count", "groupBy"]);

function sameToken(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Read-only access to the virtual data for the end-to-end suite, which runs in
 * its own process and so cannot see this server's memory.
 *
 * It does not exist unless the server was started with DEMO_TEST_TOKEN set —
 * only test/serve-and-test.mjs does that, with a fresh random token per run —
 * and it only ever reads. Every change the suite makes still goes through the
 * real server actions.
 */
export async function POST(request: Request) {
  const token = process.env.DEMO_TEST_TOKEN;
  if (!token || !sameToken(request.headers.get("x-demo-test-token") ?? "", token)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { model, op, args } = (await request.json()) as {
    model?: string;
    op?: string;
    args?: Record<string, unknown>;
  };

  const delegates = db as unknown as Record<
    string,
    Record<string, (a?: unknown) => Promise<unknown>>
  >;
  if (
    typeof model !== "string" ||
    model.startsWith("$") ||
    !Object.hasOwn(delegates, model) ||
    typeof op !== "string" ||
    !READS.has(op)
  ) {
    return NextResponse.json({ error: "Unsupported query." }, { status: 400 });
  }

  try {
    const result = await delegates[model][op](args);
    return NextResponse.json({ result: result ?? null });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
