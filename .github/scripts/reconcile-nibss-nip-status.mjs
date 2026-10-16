// NIBSS /status/summary (and systems[].status) roll up institution anomalies.
// The NIBSS UI's NIP row uses aggregate system metrics + per-minute timeline
// buckets — not that top-level rollup. After Upptime writes history/nibss-nip.yml,
// re-derive status from /api/status/systems for the nip item only.
//
// Run from repo root; no arguments.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import https from "node:https";

const SLUG = "nibss-nip";
const HISTORY_FILE = `history/${SLUG}.yml`;
const API_URL =
  "https://status.nibss-plc.com.ng/api/status/systems?range=15m";

const SEVERITY = { failure: 3, warning: 2, success: 1, no_data: 0 };

function worstStatus(...statuses) {
  let best = "success";
  for (const s of statuses) {
    if ((SEVERITY[s] ?? 0) > (SEVERITY[best] ?? 0)) best = s;
  }
  return best;
}

function worstMetricStatus(metrics) {
  if (!metrics || typeof metrics !== "object") return "no_data";
  return worstStatus(
    ...Object.values(metrics).map((m) => m?.status ?? "no_data"),
  );
}

function mapToUpptime(nibssStatus) {
  switch (nibssStatus) {
    case "success":
      return "up";
    case "warning":
      return "degraded";
    case "failure":
      return "down";
    default:
      return "down";
  }
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { Accept: "application/json" }, rejectUnauthorized: false },
      (res) => {
        let body = "";
        res.on("data", (c) => {
          body += c;
        });
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} from ${url}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(30_000, () => {
      req.destroy(new Error("timeout"));
    });
  });
}

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

function serializeYaml(obj, order) {
  const lines = [];
  for (const key of order) {
    if (obj[key] === undefined) continue;
    const v = obj[key];
    lines.push(`${key}: ${v}`);
  }
  return lines.join("\n") + "\n";
}

async function main() {
  if (!existsSync(HISTORY_FILE)) {
    console.warn(`skip ${SLUG}: ${HISTORY_FILE} missing`);
    return;
  }

  const payload = await fetchJson(API_URL);
  const nip = (payload.items || []).find((i) => i.id === "nip");
  if (!nip) {
    throw new Error("nip system not found in /api/status/systems response");
  }

  const aggregate = worstMetricStatus(nip.metrics);
  const latestBucket = nip.timeline?.length
    ? nip.timeline[nip.timeline.length - 1].status
    : "no_data";
  const nibssHealth = worstStatus(aggregate, latestBucket);
  const derived = mapToUpptime(nibssHealth);

  const existing = parseFlatYaml(readFileSync(HISTORY_FILE, "utf8"));
  const prior = existing.status;
  if (prior === derived) {
    console.log(
      `${SLUG}: status already ${derived} (nibss=${nibssHealth}, aggregate=${aggregate}, latest_bucket=${latestBucket})`,
    );
    return;
  }

  const order = [
    "url",
    "status",
    "code",
    "responseTime",
    "lastUpdated",
    "startTime",
    "generator",
  ];
  existing.status = derived;
  writeFileSync(HISTORY_FILE, serializeYaml(existing, order));
  console.log(
    `${SLUG}: status ${prior} -> ${derived} (nibss=${nibssHealth}, aggregate=${aggregate}, latest_bucket=${latestBucket})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
