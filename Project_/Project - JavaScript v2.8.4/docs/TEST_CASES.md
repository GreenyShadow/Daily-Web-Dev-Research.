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
| TC-11 | Admin views all tickets | Admin requests `GET /tickets` | `200` with full ticket list, includes pending and denied items | `200`, full list returned with tickets in every status | ✅ Pass |
| TC-12 | Agent views only support-stage tickets | Agent requests `GET /tickets` | `200` with tickets filtered to `accepted`/`in_progress`/`resolved`/`closed` | `200`, returned only support-stage tickets | ✅ Pass |
| TC-13 | Member deletes own pending ticket | Member `DELETE /tickets/:id` on a pending ticket they created | `204` and ticket removed | `204`, ticket removed from list | ✅ Pass |
| TC-14 | Admin denies a pending ticket | Admin `PATCH /tickets/:id` to `{ status: 'denied', triageNote: 'Not valid' }` | `200`, status `denied`, `triageNote` saved | `200`, status `denied`, history entry logged | ✅ Pass |
| TC-15 | Agent releases a claimed ticket | Agent `POST /tickets/:id/release` on a ticket they currently own | `200`, status becomes `accepted`, `assignedTo` clears | `200`, status `accepted`, `assignedTo:null` | ✅ Pass |
| TC-16 | Agent reassigns a claimed ticket | Agent `POST /tickets/:id/reassign` with `to: 'Priya'` | `200`, `assignedTo:'Priya'`, history updated | `200`, assigned to `Priya`, history shows reassignment | ✅ Pass |
| TC-17 | Admin creates an agent account | Admin `POST /users` with new agent data | `201`, new user returned without password | `201`, created `username`, `role:'agent'` | ✅ Pass |
| TC-18 | Admin updates user role and invalidates sessions | Admin `PATCH /users/Priya` to `{ role: 'admin' }` | `200`, role changed, related sessions revoked | `200`, role updated, prior session token later invalid | ✅ Pass |
| TC-19 | Admin cannot delete their own account | Admin `DELETE /users/Admin` | `400` with self-delete error | `400 {"error":"You can't delete the account you're logged in as"}` | ✅ Pass |
| TC-20 | Agent adds internal comment to a ticket | Agent `POST /tickets/:id/comments` with `text` | `201`, ticket returned with comment added | `201`, comment present in ticket comments | ✅ Pass |
| TC-21 | Member cannot add internal comment | Member `POST /tickets/:id/comments` | `403` — forbidden for members | `403 {"error":"Not allowed for this role"}` | ✅ Pass |
| TC-22 | Get a non-existent ticket | Any authenticated user requests `GET /tickets/invalid` | `404` | `404 {"error":"Ticket not found"}` | ✅ Pass |
| TC-23 | Create ticket with missing fields | `POST /tickets` missing `title` | `400` with missing fields error | `400 {"error":"Missing required fields: name, department, priority, title"}` | ✅ Pass |
| TC-24 | Logout invalidates token | User `POST /logout`, then reuses same token | `204` then `401` on reuse | `204`, subsequent request `401 {"error":"Invalid or expired session"}` | ✅ Pass |
| TC-25 | Agent claims a non-accepted ticket | Agent `POST /tickets/:id/claim` on a pending ticket | `409` — only accepted tickets can be claimed | `409 {"error":"Only tickets waiting in the queue can be claimed"}` | ✅ Pass |

**Result: 25 / 25 passed.**

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
