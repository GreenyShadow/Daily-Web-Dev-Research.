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

### BUG-002 — Member "Edit request" modal was unresponsive (couldn't type or click anything in it)

- **Severity:** High
- **Component:** `UI-React/src/pages/member/MemberPage.jsx` — the "Edit request" panel
- **Found during:** manual walkthrough of the Member → My tickets → Edit request flow.
- **Description:** A Member could open a pending ticket's detail view and click "Edit request", and the edit panel would render on screen correctly (title, description, department, priority fields, Save changes button) — but none of it was interactive. The title/description fields couldn't be typed into, the dropdowns couldn't be changed, and Save changes did nothing on click.
- **Steps to reproduce (before fix):**
  1. Log in as a Member with at least one `pending` ticket.
  2. Open the ticket from "My tickets" (opens the ticket detail modal).
  3. Click "Edit request".
  4. Observed: the edit form appears on top of the ticket detail view, but clicking or typing into any of its fields has no effect.
- **Root cause:** The ticket detail view (`TicketDetailModal`) is a Radix UI `Dialog` (via the shared `Modal` component). Radix Dialogs set `pointer-events: none` on `<body>` while open, and only re-enable pointer events for content rendered inside their own portal. The "Edit request" panel was a hand-rolled `<div className="modal-backdrop">…</div>` written directly in `MemberPage`'s JSX — not inside that Radix portal — so even though it displayed on top visually, it inherited the `pointer-events: none` lock and every control inside it was inert.
- **Fix:** Replaced the hand-rolled edit-request `<div>` with the same `Modal` component used elsewhere (`components/Modal.jsx`, wrapping Radix's `Dialog`). The edit form now renders through Radix's own portal and dialog stack, so it participates correctly in the pointer-events/focus handling and is fully interactive again.
- **Status:** Fixed.

---

## Known limitations (not bugs — deliberate scope decisions for this stage)

These were noted during testing but are **not** being changed right now, either because they are appropriate for the current stage of the project or because they are already flagged as gaps to close once the planned C#/ASP.NET Core + EF Core port is implemented.

| # | Observation | Why it's not being fixed here |
|---|---|---|
| L-1 | Sessions are stored in memory on the API process and are lost on server restart, forcing everyone to log in again. | No persistent session/DB layer at this stage; see note above. |
| L-2 | Passwords are stored in plaintext in `users.json`. | No hashing/credential store at this stage; see note above. |
| L-3 | No pagination on ticket lists. | Not a problem at the current seed-data scale (15 tickets); revisit if/when real usage grows. |
| L-4 | No email/in-app notification when a ticket's status changes or it's reassigned. | Out of scope for the current schedule; flagged as a possible enhancement, not a defect. |

---

## Testing approach

Testing was done manually against the running Node/Express API and the static HTML/JS front ends (Admin, Agent, Member, Auth), using the seeded accounts and tickets in `API/users.json` / `API/tickets.json`. See `docs/TEST_CASES.md` for the full list of scenarios exercised and their results.