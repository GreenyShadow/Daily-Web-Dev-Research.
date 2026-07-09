# User Guide — Internal Support Request Management System

This guide explains how to use the system in each of its three roles: **Member**, **Agent**, and **Admin**.

To try it yourself, start the API and open `UI/Auth/index.html` in a browser (see `README.md` → "Running the prototype locally"). Log in with one of the seeded demo accounts below.

| Username | Password | Role |
|---|---|---|
| `Admin` | `Demo` | Admin |
| `Agent` | `Demo` | Agent |
| `Priya` | `Demo` | Agent |
| `Member` | `Demo` | Member |
| `Sofia` | `Demo` | Member |

---

## 1. Logging in

Open the Auth screen and enter a username/password. On success, you're redirected automatically to the right screen for your role (Member, Agent, or Admin). Self-service registration is disabled — only an Admin can create new accounts.

## 2. Member guide

As a Member you can submit requests and track your own tickets.

**Submitting a request**
1. Go to the **Submit** tab.
2. Fill in: department, priority, topic, title, and a description.
3. Submit — your request starts in the **pending** state, waiting for Admin review.

**Managing your requests**
- Go to **My Tickets** to see everything you've submitted, with its current status.
- While a ticket is still **pending**, you can edit its details or cancel it.
- Once an Admin has accepted or denied it, you can no longer edit or cancel it — you'll only be able to view its progress and any notes it picks up along the way.

**Your dashboard** shows an at-a-glance summary of how many requests you've sent, and their current states.

## 3. Agent guide

As an Agent you work tickets that have already cleared Admin triage.

**The queue**
- The **Queue** shows tickets that are `accepted` but not yet claimed by anyone.
- Click **Claim** to take a ticket — it moves to `in_progress` and is assigned to you.

**Your work**
- The **My Work** view shows tickets currently assigned to you.
- From here you can:
  - **Release** a ticket back to the open queue if you can't work it.
  - **Reassign** it to a teammate.
  - Move it to **Resolved** once you've addressed it, and later to **Closed**.
  - Add **comments** — an internal discussion thread visible to Admins and other Agents (not the original requester).

**Overview** gives you a quick summary of queue size and your current workload.

## 4. Admin guide

As an Admin you triage incoming requests, manage accounts, and monitor the system.

**Triage**
- New requests arrive as `pending`. From the **Overview** tab, **Accept** moves a request into the support queue for Agents to pick up; **Deny** rejects it (you can attach a note explaining why).
- **Auto-Triage**: a rule-based helper that automatically denies obvious junk (empty/too-short descriptions, unrecognized departments, spam-like text, or language flagged as reputation-damaging). It only ever denies — it never auto-accepts — and it only touches requests that haven't been reviewed yet, so anything already accepted, claimed, resolved, or closed is left alone.

**Reports**
- Pick a time range (Today / Last 7 Days / Last 30 Days / All Time / Custom).
- See total requests, and a breakdown of awaiting/accepted/denied/expired.
- **Status Distribution** donut chart and a **Daily Volume** bar chart for the selected range.
- **Agent Workload** — how many tickets are currently assigned to each agent, split into open (still active) vs. closed (resolved/closed), so you can see who's carrying the most work.

**User management**
- Add new accounts (username, password, role).
- Edit a user's role or reset their password (this logs them out of any existing session).
- Remove an account. You can't delete your own account, and the system won't let you remove or demote the last remaining Admin.

---

## Quick reference: ticket status meanings

| Status | Meaning |
|---|---|
| `pending` | Submitted, awaiting Admin review. |
| `accepted` | Approved by Admin, waiting in the queue for an Agent. |
| `in_progress` | An Agent has claimed it and is working on it. |
| `resolved` | The Agent has addressed it. |
| `closed` | Fully wrapped up. |
| `denied` | Rejected by Admin (or Auto-Triage), with a note explaining why. |
