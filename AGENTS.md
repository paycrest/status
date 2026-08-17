# Paycrest Status — Agent instructions

Upptime-powered status page for Paycrest ([status.paycrest.io](https://status.paycrest.io)). Monitors run via GitHub Actions; incident history lives in this repo. See [README.md](README.md).

## Issue tracker (Jira) — engineering work

File **engineering** work (monitors, Astro site, workflows, repo tooling) in Jira project **KAN** ([paycrest-io.atlassian.net](https://paycrest-io.atlassian.net)), label **`status`**. See [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md) for issue types, Atlassian MCP usage, and PR linking. **Ticket spec:** [docs/agents/ticket-spec-template.md](docs/agents/ticket-spec-template.md) — use the **Bug** fields *or* the **Task** fields, never both. **PR template:** [.github/pull_request_template.md](.github/pull_request_template.md) (separate from ticket spec).

Do **not** use `gh issue create` or GitHub Issues for engineering tickets.

## Operational issues (Upptime) — stay on GitHub

**Do not** move these to Jira:

- **Incidents** — created/updated automatically by Upptime when monitors fail or recover
- **Scheduled maintenance** — use `.github/ISSUE_TEMPLATE/maintainance-event.md` (Upptime reads `start` / `end` / `expectedDown` in the issue body)

The legacy `bug_report.md` template remains for compatibility; prefer Jira for engineering bugs (see above).

## GitHub PRs

Use [.github/pull_request_template.md](.github/pull_request_template.md). Prefix **branch** with the Jira key (e.g. `KAN-123-short-description`) and **PR title** with `KAN-123: Short description`. Include `Jira Issue: https://paycrest-io.atlassian.net/browse/KAN-123` in the description. Do not add AI attribution to PR titles or descriptions.

## Conventions

- Custom Astro site under `site/`; monitor config in `.upptimerc.yml` / `history/`.
- Do not re-enable upstream `update-template.yml` without review — it overwrites custom workflows.
