// Reads each history/<slug>.yml after `upptime/uptime-monitor` has updated
// it, and appends one NDJSON line per service to data/checks/<slug>.ndjson.
//
// Output line shape:
//   {"ts":"2026-04-30T03:00:00Z","status":"up","code":200,"responseTime":352}
//
// Run from repo root with no arguments.

import {
  readFileSync,
  readdirSync,
  appendFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";

const HISTORY_DIR = "history";
const OUT_DIR = "data/checks";

mkdirSync(OUT_DIR, { recursive: true });

// Tiny, dependency-free parser for the flat YAML Upptime emits — keys at
// column zero, scalar values, no nesting. Good enough; if Upptime ever
// emits something richer we'd need a real parser.
function parseFlatYaml(text) {
  const obj = {};
  for (const raw of text.split("\n")) {
    if (!raw || raw.startsWith("#")) continue;
    const colon = raw.indexOf(":");
    if (colon === -1) continue;
    const key = raw.slice(0, colon).trim();
    let value = raw.slice(colon + 1).trim();
    // Strip surrounding quotes if any.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    obj[key] = value;
  }
  return obj;
}

const ymlFiles = readdirSync(HISTORY_DIR).filter((f) => f.endsWith(".yml"));
let appended = 0;
for (const f of ymlFiles) {
  const slug = f.replace(/\.yml$/, "");
  const text = readFileSync(join(HISTORY_DIR, f), "utf8");
  const parsed = parseFlatYaml(text);
  if (!parsed.lastUpdated || !parsed.status) {
    console.warn(`skip ${slug}: missing lastUpdated/status`);
    continue;
  }
  const code = Number(parsed.code);
  const responseTime = Number(parsed.responseTime);
  const line =
    JSON.stringify({
      ts: parsed.lastUpdated,
      status: parsed.status,
      code: Number.isFinite(code) ? code : null,
      responseTime: Number.isFinite(responseTime) ? responseTime : null,
    }) + "\n";

  const out = join(OUT_DIR, `${slug}.ndjson`);

  // Guard against duplicate appends if a workflow re-runs against an
  // unchanged YAML file: skip if the last line already has this ts.
  if (existsSync(out)) {
    const tail = readFileSync(out, "utf8").trimEnd().split("\n").pop();
    if (tail) {
      try {
        const last = JSON.parse(tail);
        if (last.ts === parsed.lastUpdated) {
          console.log(`skip ${slug}: ts ${parsed.lastUpdated} already logged`);
          continue;
        }
      } catch {
        // Malformed last line — append anyway.
      }
    }
  }

  appendFileSync(out, line);
  appended++;
}

console.log(`appended ${appended} of ${ymlFiles.length} services`);
