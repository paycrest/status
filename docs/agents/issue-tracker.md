# Issue tracker (Jira)

Paycrest **engineering** issues for the status repo are filed in **Jira**, not GitHub Issues.

**Upptime operational issues** (automated incidents, scheduled maintenance) **remain on GitHub** — see [AGENTS.md](../../AGENTS.md).

## Target

- **Site:** [paycrest-io.atlassian.net](https://paycrest-io.atlassian.net) (cloud)
- **Project:** KAN (Engineering)
- **Repo label:** `repo-status` (required on every ticket for this repository)

## When to create a Jira ticket

Use Jira for engineering work on this repo, for example:

- Add, remove, or change uptime monitors
- Astro status site changes
- Workflow or CI changes (excluding Upptime auto-generated incident issues)
- Bugs in the status page build or monitor configuration

Do **not** use Jira for:

- Live service outages (Upptime creates GitHub incident issues automatically)
- Scheduled maintenance windows (use `maintainance-event.md` on GitHub)

Do **not** use `gh issue create` for engineering work.

## Issue type mapping

| Kind of work | Jira issue type |
|--------------|-----------------|
| Bug, regression, broken monitor/site build | **Bug** |
| Enhancement, chore, new monitor, vertical slice | **Task** |

No Story/Epic usage for now.

## How to create (agents / Claude Code skills)

Use **Atlassian MCP** tools against cloud `paycrest-io.atlassian.net`, project **KAN**.

Skills (`qa`, `triage`, `to-issues`): read this file before filing engineering issues for status.

1. Set issue type: **Bug** or **Task** (see table above).
2. Set **labels:** `repo-status` (required).
3. Title: clear, actionable summary.
4. Description: context, steps to reproduce (bugs), acceptance criteria (tasks).

Humans may also create tickets on the [KAN board](https://paycrest-io.atlassian.net/jira/software/projects/KAN/boards/1).

## PR ↔ Jira linking

- **Branch:** `KAN-123-short-description`
- **PR title:** `KAN-123: Short description`
- **PR description:** include  
  `Jira Issue: https://paycrest-io.atlassian.net/browse/KAN-123`

Pull requests stay on **GitHub**; only engineering tickets live in Jira.

## References

- **KAN board:** https://paycrest-io.atlassian.net/jira/software/projects/KAN/boards/1
- **Upptime incidents/maintenance:** GitHub Issues in this repo (operational)
- Existing GitHub issues: left as-is; no backlog migration
- Engineering intake: Jira contact link in `.github/ISSUE_TEMPLATE/config.yml`
