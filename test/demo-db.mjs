/**
 * The suite's view of the virtual data.
 *
 * The data lives in the server's memory, so the suite cannot open it
 * directly. This speaks the same `db.task.findMany({...})` shape the app uses
 * and sends each read to /api/demo/query, which exists only when the server
 * was started with the matching DEMO_TEST_TOKEN. Reads only: every change the
 * suite makes goes through the real server actions.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function demoDb(base, token) {
  async function query(model, op, args) {
    const res = await fetch(`${base}/api/demo/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-demo-test-token": token },
      body: JSON.stringify({ model, op, args }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`db.${model}.${op} failed (${res.status}): ${text}`);
    // Dates cross the wire as ISO strings; turn them back into Dates.
    return JSON.parse(text, (_k, v) =>
      typeof v === "string" && ISO_DATE.test(v) ? new Date(v) : v,
    ).result;
  }

  return new Proxy(
    { $disconnect: async () => {} },
    {
      get(target, model) {
        if (model in target) return target[model];
        return new Proxy({}, { get: (_t, op) => (args) => query(model, op, args) });
      },
    },
  );
}
