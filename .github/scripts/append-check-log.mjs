// Reads each history/<slug>.yml after `upptime/uptime-monitor` has updated
// it, then writes the rolling 48-hour window of checks back to
// data/checks/<slug>.ndjson — adding the new check and dropping anything
// older than 48 hours from the new check's timestamp.
//
// Output line shape:
//   {"ts":"2026-04-30T03:00:00Z","status":"up","code":200,"responseTime":352}
//
// Run from repo root with no arguments.

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";

const HISTORY_DIR = "history";
const OUT_DIR = "data/checks";
const RETAIN_MS = 48 * 60 * 60 * 1000; // 48-hour rolling window

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

function readExistingEntries(file) {
  if (!existsSync(file)) return [];
  const out = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (typeof entry?.ts === "string" && Number.isFinite(Date.parse(entry.ts))) {
        out.push(entry);
      }
    } catch {
      // drop malformed lines
    }
  }
  return out;
}

const ymlFiles = readdirSync(HISTORY_DIR).filter((f) => f.endsWith(".yml"));
let appended = 0;
let trimmedOnly = 0;

for (const f of ymlFiles) {
  const slug = f.replace(/\.yml$/, "");
  const text = readFileSync(join(HISTORY_DIR, f), "utf8");
  const parsed = parseFlatYaml(text);
  if (!parsed.lastUpdated || !parsed.status) {
    console.warn(`skip ${slug}: missing lastUpdated/status`);
    continue;
  }
  const newTsMs = Date.parse(parsed.lastUpdated);
  if (!Number.isFinite(newTsMs)) {
    console.warn(`skip ${slug}: bad lastUpdated ${parsed.lastUpdated}`);
    continue;
  }
  const code = Number(parsed.code);
  const responseTime = Number(parsed.responseTime);
  const newEntry = {
    ts: parsed.lastUpdated,
    status: parsed.status,
    code: Number.isFinite(code) ? code : null,
    responseTime: Number.isFinite(responseTime) ? responseTime : null,
  };

  const out = join(OUT_DIR, `${slug}.ndjson`);
  const existing = readExistingEntries(out);
  const before = existing.length;

  // Apply the rolling window relative to the new check's timestamp.
  const windowed = existing.filter(
    (e) => newTsMs - Date.parse(e.ts) <= RETAIN_MS,
  );
  const dropped = before - windowed.length;

  // Dedup against the new ts: already logged → no append, but we may still
  // be writing the file back to drop old rows the window just expired.
  const isDup = windowed.some((e) => e.ts === parsed.lastUpdated);
  const final = isDup ? windowed : [...windowed, newEntry];

  // Sort ascending by ts so the head is the oldest row in the window.
  final.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));

  const previous = existsSync(out) ? readFileSync(out, "utf8") : "";
  const next =
    final.map((e) => JSON.stringify(e)).join("\n") + (final.length ? "\n" : "");

  if (previous === next) {
    console.log(`${slug}: no change`);
    continue;
  }
  writeFileSync(out, next);
  if (isDup) {
    trimmedOnly++;
    console.log(
      `${slug}: ts ${parsed.lastUpdated} already logged; dropped ${dropped} old row(s); now ${final.length}`,
    );
  } else {
    appended++;
    console.log(
      `${slug}: appended ts ${parsed.lastUpdated}; dropped ${dropped} old row(s); now ${final.length}`,
    );
  }
}

console.log(
  `done: ${appended} appended, ${trimmedOnly} trim-only, ${ymlFiles.length} services seen`,
);
