# Software Requirements Specification (SRS)

## Internal Support Request Management System

**Document version:** 1.0
**Status:** Baseline — validated against the working Node/Express + JS prototype in this repository; target implementation stack is C# / ASP.NET Core MVC / Entity Framework Core / SQL Server (see `docs/diagrams/architecture-diagram.svg`).

---

## 1. Introduction

### 1.1 Purpose

This document specifies the functional and non-functional requirements for the Internal Support Request Management System, a ticketing application that lets employees ("Members") submit internal support requests, lets Admins triage those requests, and lets support Agents work them through to resolution.

It is written to guide the C# / ASP.NET Core MVC / EF Core / SQL Server implementation, and reflects the workflow already validated in the project's working prototype (`API/`, `UI/`).

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

- `README.md` — project overview and prototype run instructions.
- `docs/USER_GUIDE.md` — end-user guide for all three roles.
- `docs/TEST_CASES.md`, `docs/BUGFIX_LOG.md` — testing evidence and known limitations.
- `docs/diagrams/use-case-diagram-member.svg`, `use-case-diagram-agent.svg`, `use-case-diagram-admin.svg`, `erd.svg`, `class-diagram.svg`, `architecture-diagram.svg`.

### 1.5 Assumptions and constraints

- This is a university course/internship assignment, not a production system. Security/scaling requirements are written at a level appropriate to that context (see §4).
- Self-service account registration is disabled; all accounts are provisioned by an Admin.
- A ticket has exactly one requester (Member) and at most one assigned Agent at a time.
- The current repository state is a functional prototype (Node/Express + flat JSON files) used to validate the data model and workflow; it is not the graded deliverable stack. The graded deliverable is the C#/ASP.NET Core MVC/EF Core/SQL Server port described in §5–§7.

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

- Server: ASP.NET Core MVC application, hosted on Windows/Linux, backed by SQL Server.
- Client: any evergreen desktop web browser (Chrome, Edge, Firefox). No mobile-native app.

### 2.4 Design and implementation constraints

- Must use C#, ASP.NET Core MVC, Entity Framework Core (code-first), and SQL Server, per the assignment brief.
- Passwords must be hashed (not plaintext) — this is a known gap in the prototype (`docs/BUGFIX_LOG.md`, L-2) that the C# port must close using ASP.NET Core Identity or equivalent.

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
| FR-4.10 | An Admin shall be able to view a report of ticket counts by status (pending/accepted/denied/expired) for a selectable time range (today / 7 days / 30 days / all time / custom). | M | UC-16 |
| FR-4.11 | An Admin shall be able to view a status-distribution chart and a daily-volume trend chart for the selected range. | S | UC-16 |
| FR-4.12 | An Admin shall be able to view per-Agent workload (open vs. closed ticket counts). | S | UC-16 |
| FR-4.13 | An Admin shall be able to see and act on all tickets regardless of status (full visibility, unlike Member/Agent). | M | UC-13, UC-16 |

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
| NFR-1 | Security | Passwords shall be stored hashed (e.g., ASP.NET Core Identity's PBKDF2/Argon2 hashing), never in plaintext, in the C# implementation. |
| NFR-2 | Security | All state-changing endpoints/actions shall require an authenticated session and enforce the role checks in §4.1. |
| NFR-3 | Usability | Each role shall have a dedicated, uncluttered view showing only the actions relevant to that role (matching the current Member/Agent/Admin/Auth UI split). |
| NFR-4 | Reliability | A ticket's `history` array must be consistent with its current `Status`/`AssignedTo` at all times — no action may change state without appending a corresponding history entry (FR-5.1). |
| NFR-5 | Maintainability | Business rules (status transitions, role permissions, Auto-Triage rules) shall live in a service layer, independent of the MVC controllers, so they can be unit-tested without a running web server (see `architecture-diagram.svg`). |
| NFR-6 | Performance | Ticket list/queue queries shall remain responsive at the assignment's expected data scale (tens to low hundreds of tickets); pagination is not required at this scale but the query layer should not preclude adding it later. |
| NFR-7 | Portability | The application shall run against SQL Server via EF Core code-first migrations, so the schema can be recreated from source on any grader's machine. |

Items intentionally **not** required at this stage (documented as known limitations, not defects — see `docs/BUGFIX_LOG.md`): email/push notifications, horizontal scaling, multi-factor authentication, SLA timers, audit-log tamper-proofing beyond application-level append-only writes.

---

## 6. Data Requirements

Full schema: `docs/diagrams/erd.svg`. Summary of entities and key attributes (EF Core code-first target):

- **User** — `Username` (PK), `PasswordHash`, `Role` (enum: Admin/Agent/Member), `CreatedAt`, `IsActive`.
- **Ticket** — `Id` (PK), `Title`, `Description`, `Department`, `Priority` (enum), `Topic`, `Status` (enum), `TriageNote` (nullable), `CreatedByUsername` (FK → User), `AssignedToUsername` (FK → User, nullable), `CreatedAt`, `UpdatedAt`.
- **Comment** — `Id` (PK), `TicketId` (FK → Ticket), `AuthorUsername` (FK → User), `Text`, `CreatedAt`.
- **TicketHistory** — `Id` (PK), `TicketId` (FK → Ticket), `ActorUsername` (FK → User), `Action`, `Detail`, `At`.

Relationships: one User creates many Tickets; one User is optionally assigned to many Tickets (as Agent); one Ticket has many Comments and many TicketHistory entries; every Comment/TicketHistory entry references exactly one authoring/acting User.

---

## 7. External Interface Requirements

### 7.1 User interfaces

Four role-scoped screens, matching the current prototype's structure and to be reproduced as Razor views in the C# port:

- **Auth** — shared login screen for all roles.
- **Member** — Submit, My Tickets (with search/filter), dashboard summary.
- **Agent** — Queue, My Work, reassign/comment controls, workload summary.
- **Admin** — Overview (triage + Auto-Triage), Reports (charts + workload), User management.

### 7.2 API / controller interfaces

Target controllers (per `architecture-diagram.svg`): `AuthController`, `TicketsController`, `UsersController`, `ReportsController`, each enforcing `[Authorize(Roles = "...")]` per action, mirroring the route table already validated in the prototype's `API/index.js` (see `README.md` §5 for the full existing route list, which the C# controllers are expected to reproduce one-for-one).

---

## 8. Traceability Note

This SRS was written after (and validated against) a working prototype rather than purely up front, so requirements in §4 are cross-checked against actually-implemented, manually-tested behavior (see `docs/TEST_CASES.md`) rather than being purely aspirational. Any requirement above not yet covered by a passing test case should be added to the test plan before the C# port is considered complete.
