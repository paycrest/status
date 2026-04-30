# Per-check uptime log

Each `<slug>.ndjson` file is appended once per uptime run by
`.github/scripts/append-check-log.mjs`, called from `uptime.yml`.

Line shape:
```json
{"ts":"2026-04-30T03:00:00Z","status":"up","code":200,"responseTime":352}
```

These are the authoritative source for the 15-minute candles on the
status page; `site/src/lib/data.ts` reads them at build time.
