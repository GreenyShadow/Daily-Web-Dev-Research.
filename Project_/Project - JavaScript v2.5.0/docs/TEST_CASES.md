# Test Case Report

Manual functional test pass against the running API (`API/index.js`) using the seeded accounts (`Admin`/`Demo`, `Agent`/`Demo`, `Member`/`Demo`, plus `Sofia`/`Demo`, `Priya`/`Demo`). All test tickets created during this pass were deleted afterward — `tickets.json` is unaffected.

Each case shows the request, the expected result, and the actual result observed when run against the live server.

| ID | Scenario | Steps | Expected | Actual | Result |
|---|---|---|---|---|---|
| TC-01 | Login with wrong password | `POST /login` with `Member` / wrong password | `401` with an error message | `401 {"error":"Invalid username or password"}` | ✅ Pass |
| TC-02 | Login with correct credentials | `POST /login` with `Member` / `Demo` | `200` with a bearer token and role | `200`, token + `role:"member"` returned | ✅ Pass |
| TC-03 | Member creates a ticket | `POST /tickets` as Member with required fields | `201`, ticket created with `status:"pending"` | `201`, ticket created, status `pending`, history entry logged | ✅ Pass |
| TC-04 | Member views another member's ticket | `Sofia` (member) requests `GET /tickets/:id` for a ticket created by `Member` | `403` — members can't see each other's tickets | `403 {"error":"Not allowed to view this ticket"}` | ✅ Pass |
| TC-05 | Protected route with no token | `GET /tickets` with no `Authorization` header | `401` | `401 {"error":"Missing or malformed Authorization header"}` | ✅ Pass |
| TC-06 | Member tries to set ticket status directly | Member `PATCH`es their own pending ticket with `{"status":"accepted"}` | `403` — members can only edit content, not status | `403 {"error":"You can only edit the request details, not its status"}` | ✅ Pass |
| TC-07 | Agent views a still-pending ticket | Agent requests `GET /tickets/:id` for a ticket that hasn't cleared admin review | `403` — agents only see tickets past triage | `403 {"error":"Not allowed to view this ticket"}` | ✅ Pass |
| TC-08 | Admin accepts a pending ticket | Admin `PATCH`es status to `accepted` | `200`, status becomes `accepted`, history entry added | `200`, status `accepted`, history logged with admin's name | ✅ Pass |
| TC-09 | Agent claims an accepted ticket | `POST /tickets/:id/claim` as Agent | `200`, status → `in_progress`, `assignedTo` set to the agent | `200`, status `in_progress`, `assignedTo:"Agent"`, history logged | ✅ Pass |
| TC-10 | Member cancels an already-processed ticket | Member `DELETE`s a ticket that's already `accepted`/claimed | `409` — can't cancel after review | `409 {"error":"This request has already been reviewed and can no longer be cancelled"}` | ✅ Pass |

**Result: 10 / 10 passed.**

## Bug found during this pass

While testing the Admin Auto-Triage feature separately (see `docs/BUGFIX_LOG.md`, BUG-001), a filtering bug was found where in-progress/resolved/closed tickets could incorrectly be re-evaluated and auto-denied. This was fixed; see the bug-fix log for full detail and the corrected behavior.

## Not yet covered (planned for the next testing pass)

- Agent release / reassign flows (`/tickets/:id/release`, `/tickets/:id/reassign`)
- Comment creation and visibility rules
- Admin user-management endpoints (create/patch/delete user, last-admin protections)
- Session expiry behavior (12-hour TTL) and behavior after `/logout`
- Front-end UI interaction tests (as opposed to direct API calls) — clicking through each role's screens in a browser

## How to re-run these tests

1. `cd API && npm install && npm start`
2. Use `curl` or any HTTP client to hit `http://localhost:3000` with the steps above, or exercise the same flows through the UI screens in a browser.
3. Seeded accounts: `Admin`/`Demo` (admin), `Agent`/`Demo` and `Priya`/`Demo` (agents), `Member`/`Demo` and `Sofia`/`Demo` (members) — all passwords are `Demo`.
