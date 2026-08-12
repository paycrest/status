# Ticket / Spec template (Jira KAN)

Copy this into the **Jira ticket description** when creating **engineering** work for the status repo. The ticket is the single source of truth — no spec, no build. Add a **flowchart in a Jira comment** when the change touches multi-step monitor or workflow flows.

**Label:** `repo-status` (required)

**Note:** Upptime **operational** incidents and scheduled maintenance stay on **GitHub Issues** — do not use this template for live outages.

---

## User Story

Add the details of this issue from the user's POV.

---

## Acceptance Criteria

Include at least one **failure-case** scenario, not only the happy path.

1. **GIVEN** …
   **WHEN** …
   **THEN** …

2. **GIVEN** … (failure / edge case)
   **WHEN** …
   **THEN** …

---

## Tech Details

- Upptime monitors (`.upptimerc.yml`) add/remove/change
- Astro status site pages or components
- GitHub Actions / workflow changes
- GitHub Issues still used for Upptime auto-incidents and maintenance events

---

## Money-safety

- Touches monitors or pages that gate production deploys or payment paths? **Yes / No**
- If **Yes**: second human reviewer required; verify false-positive/negative impact.
- Cosmetic site copy or non-critical monitor tweaks: usually **No**.

---

## Notes / Assumptions

- Assumptions that must stay true for this change to remain correct.

---

## Open Questions

- …

---

## Bug tickets (shorter variant)

For **Bug** issue type, use at minimum:

**Describe the bug** — what is wrong (broken build, wrong monitor config).

**To reproduce** — file, workflow, steps.

**Expected** — correct site or monitor behavior.

**Environment** — local preview, production status page.

**Acceptance criteria** — **GIVEN / WHEN / THEN** for the fix, including one regression check.
