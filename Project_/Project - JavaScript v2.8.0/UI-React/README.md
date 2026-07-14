# UI-React

A React 19 + Vite single-page app that replaces the plain HTML/CSS/JS front end in `UI/` with the same functionality, wired to the **same, unmodified** `API/` (Node/Express) backend. Nothing in `API/` changes — this is a drop-in front-end replacement.

It covers every route the original UI used: login/logout, Member submit + manage tickets, Agent queue/claim/release/reassign/comments, Admin triage + Auto-Triage + reports (charts) + user management.

## Stack

- React 19, React Router 7 (role-based routes + guards)
- Vite 8 (dev server + build)
- Recharts (status donut chart, daily volume bar chart on the Admin Reports tab)
- Plain CSS with a shared design-token file (`src/index.css`) — no UI kit

## Project layout

```
UI-React/
├── src/
│   ├── lib/
│   │   ├── api.js            # fetch wrapper for every backend route
│   │   └── constants.js      # statuses, departments, priorities, Auto-Triage rules
│   ├── context/AuthContext.jsx  # session/token state, persisted in localStorage
│   ├── hooks/useAuthedApi.js    # binds api.js calls to the current token, auto-logout on 401
│   ├── components/           # StatusBadge, LifecycleRail, Shell (sidebar layout),
│   │                          # TicketList, TicketDetailModal, Modal, Banner, PageHeader
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── member/MemberPage.jsx   # Submit + My tickets
│   │   ├── agent/AgentPage.jsx     # Queue + My work + Overview
│   │   └── admin/                  # Triage, Reports, Users (one file each)
│   ├── App.jsx                # routes + role guards
│   └── main.jsx
└── .env.example               # VITE_API_URL
```

## Running it

1. **Start the existing API** (unchanged):
   ```bash
   cd ../API
   npm install
   npm start
   ```
   This serves `http://localhost:3000`.

2. **Start the React app:**
   ```bash
   cd UI-React
   npm install
   npm run dev
   ```
   Opens on `http://localhost:5173` (Vite's default). It talks to the API via `VITE_API_URL`, which defaults to `http://localhost:3000` — copy `.env.example` to `.env` if you need to point it elsewhere.

3. **Log in** with any seeded account, e.g. `Admin` / `Demo`, `Agent` / `Demo`, `Member` / `Demo` (see `docs/USER_GUIDE.md`). The login screen has one-click buttons that fill in each demo username for you.

4. **Build for production:**
   ```bash
   npm run build
   ```
   Outputs static files to `dist/` — serve them with any static host; the API's CORS is already open.

## Notes on parity with the original UI

- Same ticket lifecycle, same role permissions, same field names sent to the API (`name`, `department`, `priority`, `topic`, `title`, `description`) — no backend changes were needed.
- Auto-Triage rules (allowed departments, spam keywords, reputation keywords) are reproduced in `src/lib/constants.js`, matching the logic previously in `UI/Admin/app.js` — including the fix from `docs/BUGFIX_LOG.md` (BUG-001): it only ever evaluates tickets that are still `pending`.
- The 1-minute "expired" demo window for pending tickets is preserved (`isExpired()` in `constants.js`), matching the original prototype's demo-scale behavior — not meant to represent a real SLA timer.
- One addition not in the original UI: a horizontal "lifecycle rail" on the ticket detail view, showing where a ticket sits in `pending → accepted → in_progress → resolved → closed` (or its `denied` branch) at a glance.

## Known gaps vs. the vanilla-JS prototype

- No automated tests were added for the React client (mirrors the gap already flagged in `docs/TEST_CASES.md` — UI interaction testing was already listed as "not yet covered").
- Session storage uses `localStorage` (client-side only) exactly like the original UI's approach — still not a substitute for the real ASP.NET Core Identity sessions planned for the C# port.
