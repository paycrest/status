import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { parse as parseYaml } from "yaml";

const ROOT = resolve(import.meta.dirname, "../../..");

export type SiteStatus = "up" | "down" | "degraded";

export interface SiteSummary {
  name: string;
  url: string;
  icon?: string;
  slug: string;
  status: SiteStatus;
  uptime: string;
  uptimeDay: string;
  uptimeWeek: string;
  uptimeMonth: string;
  uptimeYear: string;
  time: number;
  timeDay: number;
  timeWeek: number;
  timeMonth: number;
  timeYear: number;
  dailyMinutesDown: Record<string, number>;
}

export interface HistoryEntry {
  url: string;
  status: SiteStatus;
  code: number;
  responseTime: number;
  lastUpdated: string;
  startTime: string;
}

export function loadSummary(): SiteSummary[] {
  const file = join(ROOT, "history", "summary.json");
  const raw = readFileSync(file, "utf8");
  const sites = JSON.parse(raw) as SiteSummary[];
  return sortSites(sites);
}

// Display order independent of summary.json's order — summary.json is only
// regenerated daily by summary.yml, so reordering .upptimerc.yml alone
// wouldn't change what the page shows until the next regeneration.
const DISPLAY_ORDER = [
  "aggregator",
  "noblocks",
  "noblocks-rates",
  "nibbs-funds-transfer",
  "nibbs-transaction-status-query",
  "nibbs-name-enquiry",
  "dashboard",
  "landing-page",
];

function sortSites(sites: SiteSummary[]): SiteSummary[] {
  const rank = (slug: string) => {
    const i = DISPLAY_ORDER.indexOf(slug);
    return i === -1 ? DISPLAY_ORDER.length : i;
  };
  return [...sites].sort((a, b) => rank(a.slug) - rank(b.slug));
}

export function loadHistory(slug: string): HistoryEntry | null {
  const file = join(ROOT, "history", `${slug}.yml`);
  if (!existsSync(file)) return null;
  return parseYaml(readFileSync(file, "utf8")) as HistoryEntry;
}

export interface Incident {
  slug: string;
  title: string;
  date: string;
  body?: string;
}

export function loadIncidents(): Incident[] {
  const dir = join(ROOT, "history");
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter(
    (f) => f.endsWith(".md") && f !== "README.md",
  );
  return files
    .map((f) => {
      const body = readFileSync(join(dir, f), "utf8");
      const titleMatch = body.match(/^#\s+(.+)$/m);
      const dateMatch = body.match(/\*\*Date\*\*:\s*(.+)/i);
      return {
        slug: f.replace(/\.md$/, ""),
        title: titleMatch?.[1] ?? f,
        date: dateMatch?.[1] ?? "",
        body,
      } satisfies Incident;
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export type OverallStatus = "operational" | "degraded" | "outage";

export function deriveOverallStatus(sites: SiteSummary[]): OverallStatus {
  if (sites.some((s) => s.status === "down")) return "outage";
  if (sites.some((s) => s.status === "degraded")) return "degraded";
  return "operational";
}

export function statusLabel(overall: OverallStatus): string {
  switch (overall) {
    case "operational":
      return "All systems operational";
    case "degraded":
      return "Degraded performance";
    case "outage":
      return "Service disruption";
  }
}

export function formatMs(ms: number): string {
  if (!ms) return "—";
  return `${Math.round(ms)} ms`;
}

export function dayKeys(count: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function dayStatus(
  site: SiteSummary,
  day: string,
  startDay: string | null,
): "up" | "down" | "unknown" {
  if (startDay && day < startDay) return "unknown";
  const minutesDown = site.dailyMinutesDown?.[day] ?? 0;
  if (minutesDown > 0) return "down";
  if (!startDay) return "unknown";
  return "up";
}

export function monitoringStartDay(slug: string): string | null {
  const h = loadHistory(slug);
  if (!h?.startTime) return null;
  return h.startTime.slice(0, 10);
}

// ---------------------------------------------------------------------------
// 15-minute candles
//
// Each candle represents a 15-minute slot whose status is the most recent
// known status at-or-before the slot's end time (fill-forward).
//
// Two data sources are merged, slug-keyed:
//   1. `data/checks/<slug>.ndjson` — one JSON line per uptime check,
//      written by .github/scripts/append-check-log.mjs. This is the
//      authoritative per-check time-series.
//   2. `git log` of upptime-bot status commits — used as a fallback for
//      services that don't yet have an NDJSON file (e.g. before this
//      pipeline was introduced) and as a backfill for early history.
//
// Both sources are merged into a single sorted event list per slug, with
// duplicate timestamps de-duped (NDJSON wins).

export type CandleStatus = "up" | "down" | "degraded" | "unknown";

interface CandleEvent {
  ts: number; // ms since epoch
  status: CandleStatus;
}

let _eventsBySlug: Map<string, CandleEvent[]> | null = null;

function readNdjsonEvents(slug: string): CandleEvent[] {
  const file = join(ROOT, "data", "checks", `${slug}.ndjson`);
  if (!existsSync(file)) return [];
  const events: CandleEvent[] = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const { ts, status } = JSON.parse(line) as {
        ts: string;
        status: string;
      };
      const tsMs = Date.parse(ts);
      if (!Number.isFinite(tsMs)) continue;
      if (status !== "up" && status !== "down" && status !== "degraded") continue;
      events.push({ ts: tsMs, status });
    } catch {
      // skip malformed lines
    }
  }
  return events;
}

function readGitLogEvents(nameToSlug: Map<string, string>): Map<string, CandleEvent[]> {
  const map = new Map<string, CandleEvent[]>();
  let raw = "";
  try {
    raw = execFileSync(
      "git",
      ["log", "--format=%aI%x09%s"],
      { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
  } catch {
    return map;
  }

  const re = /^(🟩|🟥|🟨)\s+(.+?)\s+is\s+(up|down|degraded)\b/u;
  for (const line of raw.split("\n")) {
    const tab = line.indexOf("\t");
    if (tab === -1) continue;
    const iso = line.slice(0, tab);
    const msg = line.slice(tab + 1);
    const m = msg.match(re);
    if (!m) continue;
    const [, , name, statusWord] = m;
    const slug = nameToSlug.get(name);
    if (!slug) continue;
    const ts = Date.parse(iso);
    if (!Number.isFinite(ts)) continue;
    const list = map.get(slug) ?? [];
    list.push({ ts, status: statusWord as CandleStatus });
    map.set(slug, list);
  }
  return map;
}

function loadAllCandleEvents(): Map<string, CandleEvent[]> {
  if (_eventsBySlug) return _eventsBySlug;
  const map = new Map<string, CandleEvent[]>();

  // Build slug→NDJSON events first (authoritative).
  const sites = loadSummary();
  for (const site of sites) {
    const events = readNdjsonEvents(site.slug);
    if (events.length) map.set(site.slug, events);
  }

  // Merge in git-log events that aren't already covered (by exact ts).
  const nameToSlug = new Map(sites.map((s) => [s.name, s.slug]));
  const fromLog = readGitLogEvents(nameToSlug);
  for (const [slug, logEvents] of fromLog.entries()) {
    const existing = map.get(slug) ?? [];
    const seenTs = new Set(existing.map((e) => e.ts));
    for (const ev of logEvents) {
      if (!seenTs.has(ev.ts)) existing.push(ev);
    }
    map.set(slug, existing);
  }

  // Sort each list ascending by timestamp.
  for (const list of map.values()) list.sort((a, b) => a.ts - b.ts);
  _eventsBySlug = map;
  return map;
}

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

export function recentCandleSlots(count: number): number[] {
  const now = Date.now();
  const aligned = Math.floor(now / FIFTEEN_MIN_MS) * FIFTEEN_MIN_MS;
  const out: number[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(aligned - i * FIFTEEN_MIN_MS);
  return out;
}

export function candleStatusForSlot(
  slug: string,
  slotStartMs: number,
  monitoringStartMs: number | null,
): CandleStatus {
  if (monitoringStartMs !== null && slotStartMs + FIFTEEN_MIN_MS <= monitoringStartMs) {
    return "unknown";
  }
  const events = loadAllCandleEvents().get(slug);
  if (!events || events.length === 0) return "unknown";
  // Latest event with ts <= slotStartMs + FIFTEEN_MIN_MS (events that occur
  // within this slot still count — they're the slot's status).
  const cutoff = slotStartMs + FIFTEEN_MIN_MS;
  let latest: CandleEvent | null = null;
  for (const ev of events) {
    if (ev.ts > cutoff) break;
    latest = ev;
  }
  if (!latest) return "unknown";
  return latest.status;
}

export function monitoringStartMs(slug: string): number | null {
  const h = loadHistory(slug);
  if (!h?.startTime) return null;
  const ms = Date.parse(h.startTime);
  return Number.isFinite(ms) ? ms : null;
}

export function formatSlotLabel(slotStartMs: number): string {
  return new Date(slotStartMs).toLocaleString("en-GB", {
    timeZone: "Africa/Lagos",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
}
