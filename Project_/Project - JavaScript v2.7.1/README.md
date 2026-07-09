# Internal Support Request Management System

A ticketing system that lets employees submit internal support requests, lets admins triage them, and lets support agents work them through to resolution.

> **Note on tech stack:** this repository currently contains a **working functional prototype** built with Node.js/Express (API) and plain HTML/CSS/JavaScript (UI), used to validate the workflow and data model. The assignment's required stack is **C# / ASP.NET Core MVC / Entity Framework Core / SQL Server** — the C# port is tracked separately and will reuse the same roles, ticket lifecycle, and data shapes documented here.

---

## 1. Project structure

```
Project/
├── API/                    # Node.js/Express backend (prototype)
│   ├── index.js            # All routes: auth, users, tickets, comments, assignment
│   ├── users.json          # Flat-file user store (username, password, role)
│   ├── tickets.json        # Flat-file ticket store
│   └── package.json
├── UI/                     # Static front end, one folder per role
│   ├── Auth/                # Login screen (shared entry point for all roles)
│   ├── Member/               # Submit requests, view own tickets
│   ├── Agent/                # Claim/release/reassign, work the queue
│   └── Admin/                # Triage, user management, reports
└── docs/                    # Project documentation (this folder)
    ├── SRS.md               # Software Requirements Specification
    ├── BUGFIX_LOG.md
    ├── TEST_CASES.md
    ├── USER_GUIDE.md
    └── diagrams/            # use-case, ERD, class, and architecture diagrams (SVG)
```

## 2. Roles

| Role | Can do |
|---|---|
| **Member** | Submit a request; view/edit/cancel their own requests while still pending. |
| **Agent** | See the support queue (tickets already accepted by an admin); claim, release, reassign tickets; update status; add internal comments. |
| **Admin** | Accept/deny incoming requests; run Auto-Triage; manage user accounts and roles; view reports (status breakdown, daily volume, agent workload). |

## 3. Ticket lifecycle

```
pending → accepted → in_progress → resolved → closed
        ↘ denied
```

- A new ticket starts as `pending`.
- An Admin either `accepts` it (moves it into the support queue) or `denies` it (with a triage note).
- Once `accepted`, an Agent can `claim` it (→ `in_progress`), `release` it back to the queue, or an Admin/Agent can `reassign` it to a different agent.
- An Agent can move a claimed ticket to `resolved`, and later to `closed`.
- Every status change and assignment change is recorded in the ticket's `history` array; agent/admin discussion happens in `comments`.

## 4. Running the prototype locally

### Requirements
- Node.js 18+

### Steps
1. **Start the API:**
   ```bash
   cd API
   npm install
   npm start
   ```
   This starts the Express server at `http://localhost:3000`. Data is read from and written to `tickets.json` / `users.json` in that same folder.

2. **Open the UI:**
   The UI is static HTML/CSS/JS with no build step. Open `UI/Auth/index.html` directly in a browser (or serve the `UI/` folder with any static file server, e.g. `npx serve UI`). The API has CORS enabled, so it works either way.

3. **Log in** with one of the seeded accounts (see `docs/USER_GUIDE.md` for the full list), e.g.:
   - `Admin` / `Demo` — admin
   - `Agent` / `Demo` — agent
   - `Member` / `Demo` — member

### Resetting demo data
`tickets.json` and `users.json` are plain JSON files — edit them directly, or delete their contents (`[]`) and restart the API to start from a clean slate. There is no database migration step in the prototype.

## 5. API summary

All routes except `/health` and `/login` require an `Authorization: Bearer <token>` header, obtained from `/login`.

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/login` | anyone | Authenticate, get a bearer token |
| POST | `/logout` | any logged-in user | Invalidate the current token |
| GET/POST/PATCH/DELETE | `/users`, `/users/:username` | admin | Manage accounts |
| GET | `/agents` | admin, agent | List agent usernames (for assignment pickers) |
| GET/POST/PATCH/DELETE | `/tickets`, `/tickets/:id` | role-scoped | Create/view/edit/cancel tickets |
| POST | `/tickets/:id/claim` | agent | Claim an accepted, unassigned ticket |
| POST | `/tickets/:id/release` | agent | Release a claimed ticket back to the queue |
| POST | `/tickets/:id/reassign` | admin, agent | Reassign a ticket to another agent |
| POST | `/tickets/:id/comments` | admin, agent | Add an internal comment |

## 6. Known limitations

See `docs/BUGFIX_LOG.md` → "Known limitations" for a list of things intentionally left as-is in the prototype (in-memory sessions, plaintext passwords, no pagination, no notifications) — these are expected to be addressed properly once the project moves to the ASP.NET Core Identity + EF Core stack.

## 7. Related docs

- `docs/SRS.md` — Software Requirements Specification (use cases, functional/non-functional requirements, data requirements).
- `docs/diagrams/use-case-diagram.svg` — actors and use cases referenced by the SRS.
- `docs/diagrams/erd.svg`, `class-diagram.svg`, `architecture-diagram.svg` — target design for the C# port.
- `docs/BUGFIX_LOG.md` — issues found and fixed during testing, plus known limitations.
- `docs/TEST_CASES.md` — manual test cases and results.
- `docs/USER_GUIDE.md` — how to use the system as a Member, Agent, or Admin.
