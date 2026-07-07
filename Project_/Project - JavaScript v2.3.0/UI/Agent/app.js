// ── Auth guard: only logged-in Agents may view this page ────────────────────
if (sessionStorage.getItem('ticketRole') !== 'agent') {
	location.href = '../Auth/index.html';
}

const qs = s => document.querySelector(s);
const qsa = s => Array.from(document.querySelectorAll(s));
const API_URL = 'http://localhost:3000';

const username = sessionStorage.getItem('ticketUser') || 'Agent';
const authToken = sessionStorage.getItem('ticketToken');

qs('#header-username').textContent = username;
qs('#overview-greeting').textContent = `Shift overview — ${username}`;

function goToLoginExpired(){
	sessionStorage.removeItem('ticketRole');
	sessionStorage.removeItem('ticketUser');
	sessionStorage.removeItem('ticketToken');
	location.href = '../Auth/index.html';
}

function authHeaders(json){
	const h = { 'Authorization': `Bearer ${authToken}` };
	if (json) h['Content-Type'] = 'application/json';
	return h;
}

async function apiRequest(path, options = {}){
	const res = await fetch(`${API_URL}${path}`, {
		...options,
		headers: { ...authHeaders(!!options.body), ...(options.headers || {}) },
	});
	if (res.status === 401) { goToLoginExpired(); throw new Error('Session expired'); }
	if (res.status === 204) return null;
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error || 'Request failed');
	return data;
}

const fetchTickets   = () => apiRequest('/tickets');
const fetchAgents    = () => apiRequest('/agents');
const claimTicket    = (id) => apiRequest(`/tickets/${encodeURIComponent(id)}/claim`, { method: 'POST' });
const releaseTicket  = (id) => apiRequest(`/tickets/${encodeURIComponent(id)}/release`, { method: 'POST' });
const reassignTicket = (id, to) => apiRequest(`/tickets/${encodeURIComponent(id)}/reassign`, { method: 'POST', body: JSON.stringify({ to }) });
const patchStatus    = (id, status) => apiRequest(`/tickets/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) });
const addComment     = (id, text) => apiRequest(`/tickets/${encodeURIComponent(id)}/comments`, { method: 'POST', body: JSON.stringify({ text }) });

function escapeHtml(str){
	if (!str) return '';
	return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatElapsed(iso){
	const created = new Date(iso).getTime();
	const diff = Math.max(0, Math.floor((Date.now() - created) / 1000));
	if (isNaN(diff)) return '0s ago';
	if (diff < 60) return `${diff}s ago`;
	if (diff < 3600){ const m = Math.floor(diff/60), s = diff%60; return `${m}m ${s}s ago`; }
	if (diff < 86400){ const h = Math.floor(diff/3600), m = Math.floor((diff%3600)/60); return `${h}h ${m}m ago`; }
	const d = Math.floor(diff/86400), h = Math.floor((diff%86400)/3600);
	return `${d}d ${h}h ago`;
}

function formatTimestamp(iso){
	try {
		return new Date(iso).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
	} catch (e) { return iso; }
}

const STAGE_LABELS = { accepted:'Queued', in_progress:'In progress', resolved:'Resolved', closed:'Closed' };

// ── Nav / view switching ─────────────────────────────────────────────────────
const railBtns = qsa('.rail-btn');
const views = {
	overview: qs('#view-overview'),
	queue: qs('#view-queue'),
	mywork: qs('#view-mywork'),
};
function showView(name){
	railBtns.forEach(b => b.classList.toggle('active', b.dataset.view === name));
	Object.entries(views).forEach(([key, el]) => el.classList.toggle('hidden', key !== name));
}
railBtns.forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));

qs('#nav-logout').addEventListener('click', () => {
	sessionStorage.removeItem('ticketRole');
	sessionStorage.removeItem('ticketUser');
	sessionStorage.removeItem('ticketToken');
	location.href = '../Auth/index.html';
});

// ── Clock ─────────────────────────────────────────────────────────────────────
function tickClock(){
	qs('#agt-clock').textContent = new Date().toLocaleTimeString(undefined, { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}
tickClock();
setInterval(tickClock, 1000);

// ── Master data ───────────────────────────────────────────────────────────────
let allTickets = [];   // every support-stage ticket visible to agents
let agentList = [];    // teammates, for the reassign picker
let openCardId = null; // which My Tickets card is expanded, preserved across refreshes
let currentFilter = 'all';

function queueTickets(){
	return allTickets.filter(tk => tk.status === 'accepted' && !tk.assignedTo);
}
function myTickets(){
	return allTickets.filter(tk => tk.assignedTo === username);
}

// ── Overview ──────────────────────────────────────────────────────────────────
const CIRCUMFERENCE = 2 * Math.PI * 80;
function setArc(el, dashLen, dashOffset){
	if (!el) return;
	el.style.strokeDasharray = `${dashLen.toFixed(2)} ${(CIRCUMFERENCE - dashLen).toFixed(2)}`;
	el.style.strokeDashoffset = `-${dashOffset.toFixed(2)}`;
}

function renderDonut(mine){
	const inProgress = mine.filter(tk => tk.status === 'in_progress').length;
	const resolved = mine.filter(tk => tk.status === 'resolved').length;
	const closed = mine.filter(tk => tk.status === 'closed').length;
	const total = mine.length;

	qs('#legend-progress').textContent = inProgress;
	qs('#legend-resolved').textContent = resolved;
	qs('#legend-closed').textContent = closed;
	qs('#donut-num').textContent = total;
	qs('#donut-label').textContent = total === 1 ? 'TICKET' : 'MINE';

	const arcProgress = qs('#arc-progress'), arcResolved = qs('#arc-resolved'), arcClosed = qs('#arc-closed');
	if (total === 0){
		[arcProgress, arcResolved, arcClosed].forEach(el => { if (el) el.style.strokeDasharray = `0 ${CIRCUMFERENCE}`; });
		return;
	}
	const lenProgress = (inProgress/total) * CIRCUMFERENCE;
	const lenResolved = (resolved/total) * CIRCUMFERENCE;
	const lenClosed = (closed/total) * CIRCUMFERENCE;
	let offset = 0;
	setArc(arcProgress, lenProgress, offset); offset += lenProgress;
	setArc(arcResolved, lenResolved, offset); offset += lenResolved;
	setArc(arcClosed, lenClosed, offset);
}

function generateBrief(queue, mine){
	const plural = (n, w) => `${n} ${w}${n !== 1 ? 's' : ''}`;
	const teamInProgress = allTickets.filter(tk => tk.status === 'in_progress').length;
	const myInProgress = mine.filter(tk => tk.status === 'in_progress').length;
	const myResolved = mine.filter(tk => tk.status === 'resolved' || tk.status === 'closed').length;
	const urgentInQueue = queue.filter(tk => tk.priority === 'Urgent' || tk.priority === 'High').length;

	if (queue.length === 0 && mine.length === 0){
		return 'Nothing waiting and nothing assigned to you right now — the queue is clear.';
	}
	let s = `<strong>${plural(queue.length,'ticket')}</strong> ${queue.length !== 1 ? 'are' : 'is'} sitting unclaimed in the queue`;
	if (urgentInQueue > 0) s += `, including <strong>${plural(urgentInQueue,'Urgent/High request')}</strong>`;
	s += '. ';
	s += `You're carrying <strong>${plural(myInProgress,'ticket')}</strong> in progress and have resolved <strong>${plural(myResolved,'ticket')}</strong> so far. `;
	s += `Across the whole team, <strong>${plural(teamInProgress,'ticket')}</strong> ${teamInProgress !== 1 ? 'are' : 'is'} currently being worked.`;
	return s;
}

function renderOverview(){
	const queue = queueTickets();
	const mine = myTickets();
	const teamInProgress = allTickets.filter(tk => tk.status === 'in_progress').length;
	const myResolved = mine.filter(tk => tk.status === 'resolved').length;

	qs('#stat-queue').textContent = queue.length;
	qs('#stat-mine').textContent = mine.length;
	qs('#stat-team-progress').textContent = teamInProgress;
	qs('#stat-resolved').textContent = myResolved;
	qs('#queue-pill').textContent = `${queue.length} in queue`;
	qs('#rail-queue-count').textContent = queue.length;
	qs('#rail-mywork-count').textContent = mine.length;

	renderDonut(mine);
	qs('#agt-brief').innerHTML = generateBrief(queue, mine);
}

// ── Queue view ────────────────────────────────────────────────────────────────
function buildQueueCard(tk){
	const card = document.createElement('div');
	card.className = 'queue-card';
	card.dataset.created = tk.createdAt;

	const beaconClass = (tk.priority === 'Urgent') ? 'beacon-urgent' : (tk.priority === 'High' ? 'beacon-high' : '');
	const priorityClass = (tk.priority === 'Urgent' || tk.priority === 'High') ? `priority-${tk.priority}` : '';

	card.innerHTML = `
		<div class="queue-main">
			<div class="queue-top">
				<span class="beacon ${beaconClass}" aria-hidden="true"></span>
				<span class="queue-title">${escapeHtml(tk.title)}</span>
				<span class="queue-id">#${escapeHtml(tk.id || '')}</span>
				<span class="queue-priority ${priorityClass}">${escapeHtml(tk.priority)}</span>
			</div>
			<div class="queue-meta">${escapeHtml(tk.name)}<span class="sep">·</span>${escapeHtml(tk.department)}</div>
			${tk.topic ? `<div class="queue-topic">${escapeHtml(tk.topic)}</div>` : ''}
			${tk.description ? `<div class="queue-desc">${escapeHtml(tk.description)}</div>` : ''}
			<div class="queue-elapsed">submitted ${escapeHtml(formatElapsed(tk.createdAt))}</div>
		</div>
		<div class="queue-actions"></div>
	`;

	const actions = card.querySelector('.queue-actions');
	const claimBtn = document.createElement('button');
	claimBtn.className = 'claim-btn';
	claimBtn.textContent = 'Claim ticket';
	claimBtn.addEventListener('click', async () => {
		claimBtn.disabled = true;
		claimBtn.textContent = 'Claiming…';
		try {
			await claimTicket(tk.id);
			await refreshAll(true);
			showView('mywork');
		} catch (err) {
			claimBtn.disabled = false;
			claimBtn.textContent = 'Claim ticket';
			alert(err.message || 'Could not claim this ticket — someone may have just picked it up.');
		}
	});
	actions.appendChild(claimBtn);
	return card;
}

function renderQueue(){
	const board = qs('#queue-board');
	const queue = queueTickets()
		.slice()
		.sort((a, b) => {
			const rank = { Urgent: 0, High: 1, Mid: 2, Low: 3 };
			const rd = (rank[a.priority] ?? 4) - (rank[b.priority] ?? 4);
			if (rd !== 0) return rd;
			return new Date(a.createdAt) - new Date(b.createdAt);
		});

	board.innerHTML = '';
	if (queue.length === 0){
		board.innerHTML = '<div class="queue-empty">The queue is empty — nothing waiting on a claim.</div>';
		return;
	}
	queue.forEach(tk => board.appendChild(buildQueueCard(tk)));
}

// ── My Tickets view ───────────────────────────────────────────────────────────
qsa('.filter-tab').forEach(btn => {
	btn.addEventListener('click', () => {
		qsa('.filter-tab').forEach(b => b.classList.remove('active'));
		btn.classList.add('active');
		currentFilter = btn.dataset.filter;
		renderWorkList();
	});
});

function buildDispatchLog(tk){
	const entries = [
		...(tk.history || []).map(h => ({ ...h, kind: 'history' })),
		...(tk.comments || []).map(c => ({ at: c.at, by: c.by, role: c.role, action: 'comment', detail: c.text, kind: 'comment' })),
	].sort((a, b) => new Date(a.at) - new Date(b.at));

	const ACTION_LABELS = {
		created: 'Submitted', status_change: 'Status changed', assignment_change: 'Assignment changed',
		claimed: 'Claimed', released: 'Released', reassigned: 'Reassigned', comment: 'Note',
	};

	if (entries.length === 0){
		return '<div class="queue-empty" style="padding:12px 0;">No activity yet.</div>';
	}

	return `<ul class="dispatch-log">${entries.map(e => `
		<li class="log-entry ${e.kind === 'comment' ? 'is-comment' : ''}">
			<div class="log-meta"><strong>${escapeHtml(e.by)}</strong> · ${ACTION_LABELS[e.action] || escapeHtml(e.action)} · ${formatTimestamp(e.at)}</div>
			${e.detail ? `<div class="log-detail">${escapeHtml(e.detail)}</div>` : ''}
		</li>`).join('')}</ul>`;
}

function buildActionsForTicket(tk){
	const wrap = document.createElement('div');
	wrap.className = 'work-actions';

	const addBtn = (label, cls, handler) => {
		const b = document.createElement('button');
		b.className = `act-btn ${cls}`;
		b.textContent = label;
		b.addEventListener('click', async (e) => {
			e.stopPropagation();
			b.disabled = true;
			try { await handler(); await refreshAll(true); }
			catch (err) { alert(err.message || 'That action failed.'); b.disabled = false; }
		});
		wrap.appendChild(b);
		return b;
	};

	if (tk.status === 'in_progress'){
		addBtn('Mark resolved', 'act-resolve', () => patchStatus(tk.id, 'resolved'));
		addBtn('Release to queue', 'act-release', () => releaseTicket(tk.id));
	} else if (tk.status === 'resolved'){
		addBtn('Close ticket', 'act-close', () => patchStatus(tk.id, 'closed'));
		addBtn('Reopen', 'act-reopen', () => patchStatus(tk.id, 'in_progress'));
	} else if (tk.status === 'closed'){
		addBtn('Reopen', 'act-reopen', () => patchStatus(tk.id, 'in_progress'));
	}

	// Reassign to a teammate
	const teammates = agentList.filter(a => a.username !== username);
	if (teammates.length > 0 && tk.status !== 'closed'){
		const row = document.createElement('div');
		row.className = 'reassign-row';
		const select = document.createElement('select');
		select.innerHTML = teammates.map(a => `<option value="${escapeHtml(a.username)}">${escapeHtml(a.username)}</option>`).join('');
		select.addEventListener('click', e => e.stopPropagation());
		const reassignBtn = document.createElement('button');
		reassignBtn.className = 'act-btn act-reassign';
		reassignBtn.textContent = 'Reassign to →';
		reassignBtn.addEventListener('click', async (e) => {
			e.stopPropagation();
			reassignBtn.disabled = true;
			try { await reassignTicket(tk.id, select.value); await refreshAll(true); }
			catch (err) { alert(err.message || 'Could not reassign.'); reassignBtn.disabled = false; }
		});
		row.appendChild(reassignBtn);
		row.appendChild(select);
		wrap.appendChild(row);
	}

	return wrap;
}

function buildWorkCard(tk){
	const card = document.createElement('div');
	card.className = `work-card is-${tk.status}`;
	card.dataset.tid = tk.id;
	if (openCardId === tk.id) card.classList.add('is-open');

	const summary = document.createElement('div');
	summary.className = 'work-summary';
	summary.innerHTML = `
		<div class="work-main">
			<div class="work-top">
				<span class="work-title">${escapeHtml(tk.title)}</span>
				<span class="work-id">#${escapeHtml(tk.id || '')}</span>
				<span class="work-stage">${STAGE_LABELS[tk.status] || escapeHtml(tk.status)}</span>
			</div>
			<div class="work-meta">${escapeHtml(tk.name)}<span class="sep">·</span>${escapeHtml(tk.department)}<span class="sep">·</span>${escapeHtml(tk.priority)}</div>
		</div>
		<svg class="work-expand-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>
	`;
	summary.addEventListener('click', () => {
		openCardId = (openCardId === tk.id) ? null : tk.id;
		renderWorkList();
	});
	card.appendChild(summary);

	const detail = document.createElement('div');
	detail.className = 'work-detail';
	const inner = document.createElement('div');
	inner.className = 'work-detail-inner';

	if (tk.description || tk.topic){
		const desc = document.createElement('div');
		desc.className = 'work-desc';
		desc.textContent = [tk.topic, tk.description].filter(Boolean).join(' — ');
		inner.appendChild(desc);
	}

	inner.appendChild(buildActionsForTicket(tk));

	const logHeading = document.createElement('div');
	logHeading.className = 'dispatch-log-heading';
	logHeading.textContent = 'Dispatch log';
	inner.appendChild(logHeading);

	const logWrap = document.createElement('div');
	logWrap.innerHTML = buildDispatchLog(tk);
	inner.appendChild(logWrap);

	const form = document.createElement('div');
	form.className = 'comment-form';
	form.innerHTML = `
		<textarea placeholder="Add a note for the team…" rows="1"></textarea>
		<button class="comment-submit">Add note</button>
	`;
	const textarea = form.querySelector('textarea');
	const submitBtn = form.querySelector('button');
	textarea.addEventListener('click', e => e.stopPropagation());
	submitBtn.addEventListener('click', async (e) => {
		e.stopPropagation();
		const text = textarea.value.trim();
		if (!text) return;
		submitBtn.disabled = true;
		try {
			await addComment(tk.id, text);
			await refreshAll(true);
		} catch (err) {
			alert(err.message || 'Could not post that note.');
			submitBtn.disabled = false;
		}
	});
	inner.appendChild(form);

	detail.appendChild(inner);
	card.appendChild(detail);
	return card;
}

function renderWorkList(){
	const list = qs('#work-list');
	const mine = myTickets();

	const counts = { all: mine.length, in_progress: 0, resolved: 0, closed: 0 };
	mine.forEach(tk => { if (counts[tk.status] !== undefined) counts[tk.status]++; });
	qs('#count-all').textContent = counts.all;
	qs('#count-in_progress').textContent = counts.in_progress;
	qs('#count-resolved').textContent = counts.resolved;
	qs('#count-closed').textContent = counts.closed;

	const filtered = mine.filter(tk => currentFilter === 'all' || tk.status === currentFilter);
	list.innerHTML = '';
	if (filtered.length === 0){
		list.innerHTML = `<div class="work-empty">${mine.length === 0 ? "Nothing assigned to you yet — claim something from the Queue." : 'No tickets in this view.'}</div>`;
		return;
	}
	filtered
		.slice()
		.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
		.forEach(tk => list.appendChild(buildWorkCard(tk)));
}

// ── Live elapsed-time refresh (no full re-fetch) ────────────────────────────
setInterval(() => {
	qsa('.queue-card').forEach(card => {
		const created = card.dataset.created;
		const elapsedEl = card.querySelector('.queue-elapsed');
		if (created && elapsedEl) elapsedEl.textContent = `submitted ${formatElapsed(created)}`;
	});
}, 1000);

// ── Master refresh ───────────────────────────────────────────────────────────
async function refreshAll(refetch){
	if (refetch !== false){
		try {
			[allTickets, agentList] = await Promise.all([fetchTickets(), fetchAgents()]);
		} catch (err) {
			console.warn(err);
		}
	}
	renderOverview();
	renderQueue();
	renderWorkList();
}

// Poll periodically so new admin-approved tickets and teammate activity show up
setInterval(() => refreshAll(true), 5000);

refreshAll(true);
