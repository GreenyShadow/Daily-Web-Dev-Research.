# Bug / Fix Log

Internal Support Request Management System — testing notes.
This log records issues found while reviewing and exercising the prototype, what was done about each one, and known limitations that were deliberately left as-is at this stage.

---

## Fixed issues

### BUG-001 — Auto-Triage could re-evaluate tickets already in progress

- **Severity:** Medium
- **Component:** `UI/Admin/app.js` — `runAutoTriage()`
- **Found during:** manual walkthrough of the Admin → Reports → Auto-Triage flow.
- **Description:** The auto-triage rule engine is supposed to only touch tickets that have not yet received a triage decision (i.e. still `pending`). Instead, its filter was `status !== 'accepted' && status !== 'denied'`, which also matched tickets already in `in_progress`, `resolved`, or `closed`. In practice this meant a ticket an agent had already claimed and started working on could be picked up by Auto-Triage and denied out from under them if its text happened to match a spam/reputation keyword.
- **Steps to reproduce (before fix):**
  1. Submit a ticket, have Admin accept it, have an Agent claim it (status → `in_progress`).
  2. Edit the ticket's title/description (via direct API call or the seed data) to include a flagged keyword, e.g. "test".
  3. Run Auto-Triage from the Admin Reports view.
  4. Observed: the in-progress ticket was denied, discarding the agent's claim.
- **Root cause:** The filter used an exclusion list (`!== 'accepted' && !== 'denied'`) instead of checking for the actual "unprocessed" condition. This is inconsistent with the rest of the codebase, e.g. `computeCounts()` in the same file correctly uses `!tk.status || tk.status === 'pending'` when deciding what counts as still-pending/expired.
- **Fix:** Changed the filter to `!tk.status || tk.status === 'pending'`, matching the pattern already used elsewhere (and matching the API's own `isUnprocessed()` helper). Auto-Triage now only ever considers tickets that have not cleared admin review yet.
- **Status:** Fixed.

---

## Known limitations (not bugs — deliberate scope decisions for this stage)

These were noted during testing but are **not** being changed right now, either because they are appropriate for a class-project prototype or because they are already flagged as gaps to close in the C#/EF Core rewrite.

| # | Observation | Why it's not being fixed here |
|---|---|---|
| L-1 | Sessions are stored in memory on the API process and are lost on server restart, forcing everyone to log in again. | Expected for a prototype without a persistent session/DB layer. Will be replaced by ASP.NET Core Identity / a real session store in the C# port. |
| L-2 | Passwords are stored in plaintext in `users.json`. | Same as above — hashing will be added when the user store moves to EF Core + SQL Server. |
| L-3 | No pagination on ticket lists. | Not a problem at the current seed-data scale (15 tickets); revisit if/when real usage grows. |
| L-4 | No email/in-app notification when a ticket's status changes or it's reassigned. | Out of scope for the current schedule; flagged as a possible enhancement, not a defect. |

---

## Testing approach

Testing was done manually against the running Node/Express API and the static HTML/JS front ends (Admin, Agent, Member, Auth), using the seeded accounts and tickets in `API/users.json` / `API/tickets.json`. See `docs/TEST_CASES.md` for the full list of scenarios exercised and their results.
