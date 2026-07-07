# Internal Ticket Support — JS Prototype

A role-based internal helpdesk system: Members submit requests, Admins triage
and assign them, Agents work them through to resolution. This is the
JavaScript/Node prototype, built ahead of the planned ASP.NET Core MVC /
Entity Framework Core / SQL Server port.

## Running it

```
cd API
npm install
npm start
```

The API listens on `http://localhost:3000`. Then open `UI/Auth/index.html`
in a browser (the frontend is plain HTML/CSS/JS — no build step needed).

## Demo accounts

All passwords are `Demo`.

| Username | Role   |
|----------|--------|
| Admin    | admin  |
| Agent    | agent  |
| Priya    | agent  |
| Member   | member |
| Sofia    | member |

`API/tickets.json` ships with a small set of sample requests spanning
pending, accepted, in-progress, resolved, closed, and denied states across
the last ~10 days, so the Admin Reports view has something to chart out of
the box.

## Project layout

- `API/` — Express server, flat-file JSON storage (`users.json`,
  `tickets.json`), bearer-token sessions.
- `UI/Auth/` — login page, routes to the right console based on role.
- `UI/Member/` — submit requests, track your own tickets.
- `UI/Admin/` — approve/deny requests, assign them to agents, manage user
  accounts, and view status/time-range reports.
- `UI/Agent/` — claim queued tickets, update status, comment, reassign.

## Known limitations (prototype-only)

- Sessions are in-memory and reset on server restart.
- Passwords are stored in plaintext in `users.json` — fine for a local demo,
  not for anything real.
- Data lives in flat JSON files rather than a database.

These are exactly the pieces the planned C#/ASP.NET Core/EF Core/SQL Server
port is meant to replace with real auth and a real database.
