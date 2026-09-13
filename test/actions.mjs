import fs from "node:fs";
import path from "node:path";

/**
 * Next assigns every server action a build-time id, and the client bundle
 * records it alongside the original export name:
 *
 *   createServerReference)("<id>", callServer, void 0, findSourceMapURL, "offerTask")
 *
 * Reading that map is what lets the harness invoke the real actions over HTTP,
 * exactly as the browser does, rather than writing to the database behind the
 * app's back. Ids are regenerated on every build, so this is read fresh each
 * run instead of being checked in.
 */
const RE =
  /createServerReference\)\(\s*"([a-f0-9]{40,48})"[^)]*?,\s*"([A-Za-z0-9_$]+)"\s*\)/g;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

export function actionMap(root = ".next/static/chunks") {
  const byName = new Map();
  for (const file of walk(root)) {
    const src = fs.readFileSync(file, "utf8");
    for (const [, id, name] of src.matchAll(RE)) {
      if (!byName.has(name)) byName.set(name, id);
    }
  }
  return byName;
}
