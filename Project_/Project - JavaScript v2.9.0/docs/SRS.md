# Software Requirements Specification (SRS)

## Internal Support Request Management System

**Document version:** 1.1
**Status:** Baseline — describes the system as actually implemented: a Node.js/Express API with an HTML/CSS/JS client and a React client (`API/`, `UI/`, `UI-React/`). This is the company's standard stack (JavaScript), not a temporary prototype. A future migration to C# / ASP.NET Core MVC / Entity Framework Core / SQL Server is planned separately and is not covered in detail by this document — see `docs/BUGFIX_LOG.md` for that note.

---

## 1. Introduction

### 1.1 Purpose

This document specifies the functional and non-functional requirements for the Internal Support Request Management System, a ticketing application that lets employees ("Members") submit internal support requests, lets Admins triage those requests, and lets support Agents work them through to resolution.

It documents the requirements as implemented in the system's JavaScript stack (`API/`, `UI/`, `UI-React/`), which is the system as built, tested, and used.

### 1.2 Scope

The system supports three internal user roles — **Member**, **Agent**, and **Admin** — operating on a single object type, the **support ticket**, through a fixed lifecycle:

```
pending → accepted → in_progress → resolved → closed
        ↘ denied
```

In scope: ticket submission and lifecycle management, role-based access control, an internal comment thread per ticket, a full audit history per ticket, a rule-based Auto-Triage helper, user account management, and a reporting/dashboard view.

Out of scope (see §1.5 "Assumptions and constraints"): external/customer-facing support, email or push notifications, multi-tenant/multi-department routing rules beyond a free-text department field, and SLA timers.

### 1.3 Definitions, acronyms, abbreviations

| Term | Meaning |
|---|---|
| Ticket / Request | A single internal support request submitted by a Member. |
| Queue | The set of tickets that are `accepted` but not yet claimed by an Agent. |
| Claim | An Agent taking ownership of a queued ticket. |
| Triage | The Admin's accept/deny decision on a newly submitted ticket. |
| Auto-Triage | A rule-based engine that automatically denies obviously invalid/spam-like pending tickets. |
| History | The immutable, append-only audit log of every status/assignment/comment event on a ticket. |
| SRS | Software Requirements Specification (this document). |

### 1.4 References

- `README.md` — project overview and instructions for running the app.
- `docs/USER_GUIDE.md` — end-user guide for all three roles.
- `docs/TEST_CASES.md`, `docs/BUGFIX_LOG.md` — testing evidence and known limitations.
- `docs/diagrams/use-case-diagram-member.svg`, `use-case-diagram-agent.svg`, `use-case-diagram-admin.svg`, `erd.svg`, `class-diagram.svg`, `architecture-diagram.svg`.

### 1.5 Assumptions and constraints

- This is an internal company system, written at a level of rigor appropriate to its current scale (see §4).
- Self-service account registration is disabled; all accounts are provisioned by an Admin.
- A ticket has exactly one requester (Member) and at most one assigned Agent at a time.
- The current repository (Node/Express + flat JSON files for the API; HTML/CSS/JS and React for the UI) is the implemented system described throughout §5–§7 below, not a stand-in for a different stack.

---

## 2. Overall Description

### 2.1 Product perspective

The system is a standalone internal web application, accessed by employees of a single organization. It is not integrated with any external system (no SSO, no email gateway, no external ticketing tool) in this iteration.

### 2.2 User roles and characteristics

| Role | Description | Technical proficiency assumed |
|---|---|---|
| **Member** | Any employee who needs help from an internal support function (IT, HR, Facilities, etc.). Submits and tracks their own requests. | Basic — casual web-app user. |
| **Agent** | A support-team staff member who works the ticket queue: claims, resolves, and closes tickets. | Basic–intermediate. |
| **Admin** | A support-team lead/manager who triages incoming requests, manages accounts, and reviews reports. | Intermediate. |

### 2.3 Operating environment

- Server: Node.js/Express application, runnable on Windows/Linux/macOS. Data is persisted in flat JSON files (`API/tickets.json`, `API/users.json`) rather than a database at this stage.
- Client: any evergreen desktop web browser (Chrome, Edge, Firefox). No mobile-native app. Two client implementations exist and talk to the same API: a build-free HTML/CSS/JS client (`UI/`) and a React 19 + Vite client (`UI-React/`).

### 2.4 Design and implementation constraints

- Must use JavaScript across the stack — Node.js/Express for the API, and HTML/CSS/JS (plus a React client) for the UI — per the company's standard coding language.
- Passwords must eventually be hashed (not plaintext) — this is a known gap in the current implementation (`docs/BUGFIX_LOG.md`, L-2), left as-is for now rather than a requirement this stage fails to meet by design.

---

## 3. Use Cases

Full actor/use-case map, split one diagram per role: `docs/diagrams/use-case-diagram-member.svg`, `use-case-diagram-agent.svg`, `use-case-diagram-admin.svg`. Table below assigns stable IDs referenced by the functional requirements in §4.

| UC ID | Use case | Primary actor(s) |
|---|---|---|
| UC-01 | Login | Member, Agent, Admin |
| UC-02 | Logout | Member, Agent, Admin |
| UC-03 | Submit New Request | Member |
| UC-04 | Manage My Request (edit / cancel while pending) | Member |
| UC-05 | Search & Filter My Requests | Member |
| UC-06 | View Support Queue | Agent |
| UC-07 | Claim Ticket | Agent |
| UC-08 | Release Ticket | Agent |
| UC-09 | Update Ticket Status (resolve / close) | Agent |
| UC-10 | Search & Filter Tickets | Agent |
| UC-11 | Reassign Ticket | Agent, Admin |
| UC-12 | Add Internal Comment | Agent, Admin |
| UC-13 | Review Pending Request (accept / deny) | Admin |
| UC-14 | Run Auto-Triage *(«extend»s UC-13)* | Admin (triggers), Auto-Triage Engine (executes) |
| UC-15 | Manage User Accounts | Admin |
| UC-16 | View Reports & Dashboard | Admin |
| UC-17 | Sort Ticket List by Date Created | Member, Agent, Admin |

### Sample fully-dressed use case — UC-07 Claim Ticket

- **Actor:** Agent
- **Precondition:** Ticket status is `accepted` and `AssignedTo` is null.
- **Main flow:**
  1. Agent opens the Queue view and selects a ticket.
  2. Agent selects **Claim**.
  3. System sets `AssignedTo` = current Agent, `Status` = `in_progress`, and appends a history entry.
  4. Ticket moves from the Queue view to the Agent's My Work view.
- **Alternate flow:** Another Agent claimed it first → system returns "already claimed by <agent>" and the view refreshes to remove the ticket from the visible queue.
- **Postcondition:** Ticket is exclusively owned by the claiming Agent until released or reassigned.

*(Remaining use cases follow the same accept/deny/claim/release/reassign pattern already implemented in `API/index.js`; full write-ups can be expanded per grading rubric if a fully-dressed spec is required for every UC.)*

---

## 4. Functional Requirements

Each requirement is tagged with priority: **M**ust, **S**hould, **C**ould (MoSCoW).

### 4.1 Authentication & authorization

| ID | Requirement | Priority | Ref. |
|---|---|---|---|
| FR-1.1 | The system shall authenticate a user by username and password and issue a session on success. | M | UC-01 |
| FR-1.2 | The system shall reject login with an invalid username/password with a generic error (no hint as to which field was wrong). | M | UC-01 |
| FR-1.3 | The system shall invalidate a user's session on logout. | M | UC-02 |
| FR-1.4 | The system shall restrict every action to the roles listed in §3, returning an authorization error otherwise. | M | all |
| FR-1.5 | Self-service account registration shall be disabled; accounts are created only by an Admin (UC-15). | M | UC-15 |

### 4.2 Member capabilities

| ID | Requirement | Priority | Ref. |
|---|---|---|---|
| FR-2.1 | A Member shall be able to submit a new request with department, priority, topic, title, and description; title and required fields must be validated as non-empty. | M | UC-03 |
| FR-2.2 | A new request shall start in `pending` status. | M | UC-03 |
| FR-2.3 | A Member shall be able to view a list of only their own submitted requests, with current status. | M | UC-04 |
| FR-2.4 | A Member shall be able to edit the content (not status/assignment) of a request only while it is `pending`. | M | UC-04 |
| FR-2.5 | A Member shall be able to cancel (delete) a request only while it is `pending`. | M | UC-04 |
| FR-2.6 | A Member shall not be able to view or modify another Member's requests. | M | UC-04 |
| FR-2.7 | A Member shall be able to search/filter their own request list by keyword and status. | S | UC-05 |
| FR-2.8 | A Member shall be able to sort their own request list by date created, in either direction (newest-first or oldest-first). | S | UC-17 |

### 4.3 Agent capabilities

| ID | Requirement | Priority | Ref. |
|---|---|---|---|
| FR-3.1 | An Agent shall see a Queue of tickets that are `accepted` and unassigned. | M | UC-06 |
| FR-3.2 | An Agent shall be able to claim an unassigned, accepted ticket, which assigns it to them and moves it to `in_progress`. | M | UC-07 |
| FR-3.3 | An Agent shall be able to release a ticket they are assigned to back to the open queue. | M | UC-08 |
| FR-3.4 | An Agent shall be able to move a claimed ticket to `resolved`, and later to `closed`. | M | UC-09 |
| FR-3.5 | An Agent (or Admin) shall be able to reassign a ticket to a different Agent. | M | UC-11 |
| FR-3.6 | An Agent shall be able to add an internal comment to a ticket, visible to Agents and Admins only (not the requester). | M | UC-12 |
| FR-3.7 | An Agent shall be able to search/filter the queue and their own work list by keyword, status, and priority. | S | UC-10 |
| FR-3.8 | An Agent shall not be able to view or act on tickets that have not yet cleared Admin triage (`pending`/`denied`). | M | UC-06 |
| FR-3.9 | An Agent shall be able to sort the Queue and My Work lists by date created, in either direction (newest-first or oldest-first), independently for each list. | S | UC-17 |

### 4.4 Admin capabilities

| ID | Requirement | Priority | Ref. |
|---|---|---|---|
| FR-4.1 | An Admin shall be able to accept a pending request, moving it to `accepted` (into the support queue). | M | UC-13 |
| FR-4.2 | An Admin shall be able to deny a pending request with an optional triage note, moving it to `denied`. | M | UC-13 |
| FR-4.3 | An Admin shall be able to run Auto-Triage, which automatically denies pending tickets matching configured junk/spam rules (empty/too-short description, unrecognized department, flagged keywords). | S | UC-14 |
| FR-4.4 | Auto-Triage shall only ever deny; it shall never auto-accept a ticket. | M | UC-14 |
| FR-4.5 | Auto-Triage shall only evaluate tickets that are still `pending`; tickets that have already been accepted, claimed, resolved, or closed shall never be re-evaluated or altered by it. | M | UC-14 |
| FR-4.6 | An Admin shall be able to create, edit (role/password reset), and delete user accounts. | M | UC-15 |
| FR-4.7 | The system shall prevent deleting or demoting the last remaining Admin account. | M | UC-15 |
| FR-4.8 | The system shall prevent an Admin from deleting the account they are currently logged in as. | S | UC-15 |
| FR-4.9 | Changing a user's password or role shall invalidate that user's existing session(s), forcing re-login. | S | UC-15 |
| FR-4.10 | An Admin shall be able to view a report of ticket counts by status (pending/accepted/denied/expired) for a selectable time range (today / 7 days / 30 days / all time). | M | UC-16 |
| FR-4.11 | An Admin shall be able to view a status-distribution chart and a daily-volume trend chart for the selected range. | S | UC-16 |
| FR-4.12 | An Admin shall be able to view per-Agent workload (open vs. closed ticket counts). | S | UC-16 |
| FR-4.13 | An Admin shall be able to see and act on all tickets regardless of status (full visibility, unlike Member/Agent). | M | UC-13, UC-16 |
| FR-4.14 | An Admin shall be able to sort the Triage list by date created, in either direction (newest-first or oldest-first); the list defaults to oldest-first so the longest-waiting requests surface first. | S | UC-17 |

### 4.5 Cross-cutting: history & comments

| ID | Requirement | Priority |
|---|---|---|
| FR-5.1 | Every status change and assignment change on a ticket shall be recorded in an append-only history log, including actor, role, timestamp, and a human-readable detail string. | M |
| FR-5.2 | The history log shall never be edited or deleted through any user-facing action. | M |
| FR-5.3 | Comments shall be visible to Agents and Admins but never to the requesting Member. | M |

---

## 5. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Security | Passwords shall be stored hashed, never in plaintext. Currently a known gap (`docs/BUGFIX_LOG.md`, L-2), left as-is for this stage. |
| NFR-2 | Security | All state-changing endpoints/actions shall require an authenticated session and enforce the role checks in §4.1. |
| NFR-3 | Usability | Each role shall have a dedicated, uncluttered view showing only the actions relevant to that role (matching the current Member/Agent/Admin/Auth UI split). |
| NFR-4 | Reliability | A ticket's `history` array must be consistent with its current `Status`/`AssignedTo` at all times — no action may change state without appending a corresponding history entry (FR-5.1). |
| NFR-5 | Maintainability | Business rules (status transitions, role permissions, Auto-Triage rules) shall live in code that is testable independent of route handlers (see `architecture-diagram.svg`). |
| NFR-6 | Performance | Ticket list/queue queries shall remain responsive at the current data scale (tens to low hundreds of tickets); pagination is not required at this scale but the query layer should not preclude adding it later. |
| NFR-7 | Portability | The application shall be runnable from source with `npm install && npm start`, requiring no external database server at this stage — data ships with the repo as flat JSON files. |

Items intentionally **not** required at this stage (documented as known limitations, not defects — see `docs/BUGFIX_LOG.md`): email/push notifications, horizontal scaling, multi-factor authentication, SLA timers, audit-log tamper-proofing beyond application-level append-only writes.

---

## 6. Data Requirements

Full schema diagram: `docs/diagrams/erd.svg`. The system currently persists this data as flat JSON (`API/users.json`, `API/tickets.json`); the entities and fields below reflect what's actually stored and read by `API/index.js`.

- **User** — `username` (unique key), `password` (plaintext at this stage — see `docs/BUGFIX_LOG.md` L-2), `role` (`admin` / `agent` / `member`).
- **Ticket** — `id`, `title`, `description`, `department`, `priority`, `topic`, `status`, `triageNote` (present when denied), `createdBy` (→ User), `assignedTo` (→ User, nullable), `createdAt`, `comments` (array), `history` (array).
- **Comment** (nested in `Ticket.comments`) — `id`, `by` (→ User), `text`, `at`.
- **History entry** (nested in `Ticket.history`) — `at`, `by` (→ User), `role`, `action`, `detail`.

Relationships: one User creates many Tickets; one User is optionally assigned to many Tickets (as Agent); one Ticket has many Comments and many history entries; every Comment/history entry references exactly one authoring/acting User.

---

## 7. External Interface Requirements

### 7.1 User interfaces

Four role-scoped screens, implemented twice — once as the build-free HTML/CSS/JS client (`UI/`) and once as the React client (`UI-React/`) — both talking to the same API:

- **Auth** — shared login screen for all roles.
- **Member** — Submit, My Tickets (with search/filter), dashboard summary.
- **Agent** — Queue, My Work, reassign/comment controls, workload summary.
- **Admin** — Triage (accept/deny + Auto-Triage), Reports (charts + workload), Users (account management).

### 7.2 API interfaces

The system exposes a single Express route file (`API/index.js`) covering auth, users, tickets, comments, and assignment actions, each enforcing role checks per §4.1. See `README.md` §5 for the full route table.

---

## 8. Traceability Note

This SRS was written after (and validated against) the working implementation rather than purely up front, so requirements in §4 are cross-checked against actually-implemented, manually-tested behavior (see `docs/TEST_CASES.md`) rather than being purely aspirational. Any requirement above not yet covered by a passing test case should be added to the test plan.