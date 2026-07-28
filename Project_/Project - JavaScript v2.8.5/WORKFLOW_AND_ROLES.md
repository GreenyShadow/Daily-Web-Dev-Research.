# Workflow & Roles — Project v2.8.4

This document summarizes how the prototype ticketing system works: the end-to-end workflow, how tickets are processed, what each role can do, key API endpoints, how to run the prototype, data files, and known limitations.

## 1. High-level overview
- Tech: Node.js/Express API (prototype) + static UI and a React client (`UI-React`).
- Purpose: Employees submit internal support requests (tickets); Admins triage; Agents work tickets to resolution.

## 2. Ticket lifecycle (canonical)
pending → accepted → in_progress → resolved → closed
        ↘ denied

Notes:
- New tickets start as `pending` (created by Members).
- Admins `accept` (moves into the support queue) or `deny` (sets `denied` with `triageNote`).
- Agents see only support-stage tickets (accepted/in_progress/resolved/closed).
- Agents `claim` an accepted ticket → sets `assignedTo` and `in_progress`.
- Agents may `release` (back to `accepted`), `reassign`, `resolve`, then `close`.
- All status and assignment changes are appended to the ticket's `history`; internal discussion uses `comments`.

## 3. How a ticket is processed (step-by-step)
1. Member fills the request form → `POST /tickets` → server creates a ticket with `status: "pending"` and records `createdBy` and a `history` entry.
2. Admin reviews pending tickets (triage):
   - If accepted: Admin updates ticket (`PATCH /tickets/:id`) to `{ status: 'accepted' }`.
   - If denied: Admin updates ticket to `{ status: 'denied', triageNote: '...' }`.
3. Accepted tickets appear in the agents' queue (unassigned list).
4. Agent claims ticket: `POST /tickets/:id/claim` → `assignedTo` set, `status` becomes `in_progress`, history updated.
5. Agent works ticket: may add internal comments (`POST /tickets/:id/comments`), `release` it (`POST /tickets/:id/release`), `reassign` (`POST /tickets/:id/reassign`) or update status via `PATCH /tickets/:id` to `resolved` or `closed`.
6. Members can edit or cancel their ticket only while it remains unprocessed (`pending`) — after admin triage the ticket is locked from requester edits.

## 4. Roles & permissions (what each role can do)
- Member
  - Create a ticket: `POST /tickets`.
  - View their own tickets: `GET /tickets` (returns only tickets where `createdBy` matches).
  - Edit their own ticket while unprocessed: `PATCH /tickets/:id` but only allowed fields: `title`, `description`, `department`, `priority`, `topic`.
  - Cancel (delete) their own unprocessed ticket: `DELETE /tickets/:id`.

- Agent
  - View support-stage tickets: `GET /tickets` (server filters to statuses in support stage).
  - Claim an accepted ticket: `POST /tickets/:id/claim`.
  - Release a ticket they own: `POST /tickets/:id/release`.
  - Reassign a ticket: `POST /tickets/:id/reassign` (allowed for admin or currently assigned agent).
  - Update assignment/status (restricted): `PATCH /tickets/:id` (only `status`, `assignedTo`, `triageNote`).
  - Add internal comments: `POST /tickets/:id/comments`.

- Admin
  - Full visibility of all tickets: `GET /tickets`.
  - Triage decisions: `PATCH /tickets/:id` to accept/deny and add `triageNote`.
  - User management: `GET/POST/PATCH/DELETE /users` to create/edit/remove accounts and assign roles.
  - Run Auto‑Triage (client-side helper that calls `PATCH` for matching tickets).
  - View reports (UI pages rely on the full ticket list).

Server-side role enforcement: implemented via `requireRole(...)` and logic in `API/index.js`.

## 5. Key API endpoints (summary)
- `POST /login` — authenticate, returns token.
- `POST /logout` — invalidate current token.
- `GET/POST/PATCH/DELETE /users` — admin only (manage accounts).
- `GET /agents` — list agent usernames (admin & agent).
- `GET /tickets` — role-scoped listing.
- `POST /tickets` — create ticket (member).
- `GET /tickets/:id` — view ticket (role-scoped).
- `PATCH /tickets/:id` — update ticket (role-scoped and field-restricted).
- `POST /tickets/:id/claim` — agent claims ticket.
- `POST /tickets/:id/release` — agent releases ticket.
- `POST /tickets/:id/reassign` — admin or assigned agent reassigns ticket.
- `POST /tickets/:id/comments` — add internal comment (admin & agent).
- `DELETE /tickets/:id` — delete (admin or ticket owner while unprocessed).

Client wrapper: see `UI-React/src/lib/api.js` which maps these calls to functions.

## 6. How to run the prototype locally
Requirements: Node.js 18+

1. Start API
```bash
cd API
npm install
npm start
```
API runs by default at `http://localhost:3000`. Data read/written to `API/tickets.json` and `API/users.json`.

2. UI options
- Static UI: open `UI/Auth/index.html` directly, or serve `UI/` using `npx serve UI`.
- React UI: `cd UI-React && npm install && npm run dev` (Vite serves client, default `http://localhost:5173`).

Use seeded demo accounts described in the README or `docs/USER_GUIDE.md`.

## 7. Data, storage & known limitations
- Prototype stores data in flat JSON files: `API/tickets.json`, `API/users.json`.
- Sessions: in-memory Map (`sessions`) with TTL (~12 hours); no persistence across restarts.
- Security: plaintext passwords in `users.json` (demo only), no hashed passwords, no CSRF protections, no notifications, no pagination.
- These are intentionally simple for the prototype; the C# port is expected to replace these with ASP.NET Identity + EF Core + SQL Server.

## 8. Where to look in the repo
- README: `README.md` (root of v2.8.4).
- Server: `API/index.js` (core logic, routes, role checks, lifecycle functions).
- Client API wrapper: `UI-React/src/lib/api.js`.
- Member UI: `UI-React/src/pages/member/MemberPage.jsx`.
- Agent UI: `UI-React/src/pages/agent/AgentPage.jsx`.
- Admin triage UI: `UI-React/src/pages/admin/TriageTab.jsx`.
- Docs: `docs/USER_GUIDE.md`, `docs/SRS.md`, and diagrams in `docs/diagrams/`.

## 9. Recommended next steps
- Replace flat-file storage with a DB for persistence and concurrency handling.
- Hash passwords and use persistent sessions or JWTs with refresh flow.
- Add pagination, search indexing, and notifications (email/Slack) for assigned agents.
- Harden role checks and add audit logs (separate audit store) for compliance.

---
Generated from code and README in Project v2.8.4. If you want a condensed Mermaid sequence diagram or a CSV permissions matrix, tell me which and I will add it into the repo as well.
