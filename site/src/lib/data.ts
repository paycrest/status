import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
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
