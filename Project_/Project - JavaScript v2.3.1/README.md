# Internal Ticket Support System

## Run it

```
cd API
npm install
node index.js
```

The API listens on `http://localhost:3000`. Then open any of the UI folders'
`index.html` in a browser (or serve `UI/` with any static file server):

- `UI/Auth` — login (start here)
- `UI/Admin`, `UI/Agent`, `UI/Member` — role-specific consoles

Seeded demo accounts (username / password): `Admin/Demo`, `Agent/Demo`,
`Priya/Demo` (agent), `Member/Demo`.

## What's new in this update

**Week 3 — accounts & permissions**
- Admin Console now has a **Users** tab: create accounts, change a user's
  role, reset a password, or delete an account. Registration is still
  disabled by design — this is the only way to provision accounts.
- New API routes: `GET/POST /users`, `PATCH /users/:username`,
  `DELETE /users/:username` (all admin-only). Changing a user's role or
  password revokes their active sessions. The last remaining admin can't be
  deleted or demoted, and you can't delete the account you're logged in as.
- Tightened a gap in ticket permissions: members could previously send a
  `status` update on their own ticket (effectively self-approving/denying).
  Members are now restricted to editing content fields only
  (`title`, `description`, `department`, `priority`, `topic`).

**Week 4 — ticket editing, cancellation & search**
- Member Portal: tickets that haven't been triaged yet ("pending") now show
  **Edit** and **Cancel request** actions. Editing opens a modal reusing the
  submit form's fields; cancelling deletes the ticket after confirmation.
  Once an admin has accepted or denied a request, both actions disappear —
  enforced server-side too (`409` if you try after the fact).
- Added a **search box** (by title/description/topic/department/requester)
  to the ticket lists in the Member Portal, Admin Console, and Agent
  Console, working alongside the existing status filter tabs.

## Removed
- `node_modules/` (regenerate with `npm install`) and a stray root-level
  `package-lock.json` that didn't belong to any `package.json`.
