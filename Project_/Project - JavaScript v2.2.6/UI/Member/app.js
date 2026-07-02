// ── Auth guard: only logged-in Members may view this page ───────────────────
if (sessionStorage.getItem('ticketRole') !== 'member') {
	location.href = '../Auth/index.html';
}

const qs = s => document.querySelector(s);
const qsa = s => Array.from(document.querySelectorAll(s));
const API_URL = 'http://localhost:3000';

const username = sessionStorage.getItem('ticketUser') || 'Member';
const authToken = sessionStorage.getItem('ticketToken');

// ── Nav elements ─────────────────────────────────────────────────────────────
const railBtns = qsa('.rail-btn');
const views = {
	dashboard: qs('#view-dashboard'),
	submit: qs('#view-submit'),
	mytickets: qs('#view-mytickets'),
};

function showView(name){
	railBtns.forEach(b => b.classList.toggle('active', b.dataset.view === name));
	Object.entries(views).forEach(([key, el]) => el.classList.toggle('hidden', key !== name));
	if (name === 'dashboard') refreshDashboard();
	if (name === 'mytickets') refreshTicketList();
}

railBtns.forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));
qs('#dash-new-ticket').addEventListener('click', () => showView('submit'));
qs('#sent-view-tickets').addEventListener('click', () => showView('mytickets'));

qs('#nav-logout').addEventListener('click', () => {
	sessionStorage.removeItem('ticketRole');
	sessionStorage.removeItem('ticketUser');
	sessionStorage.removeItem('ticketToken');
	location.href = '../Auth/index.html';
});

// ── Header / form prefill ────────────────────────────────────────────────────
qs('#header-username').textContent = username;
qs('#dash-greeting').textContent = `Welcome back, ${username}`;
qs('#name').value = username;

// ── Data layer (API first, localStorage fallback) ───────────────────────────
function loadTicketsLocal(){
	try { return JSON.parse(localStorage.getItem('tickets') || '[]'); }
	catch (e) { return []; }
}
function saveTicketsLocal(tickets){
	localStorage.setItem('tickets', JSON.stringify(tickets));
}

function goToLoginExpired(){
	sessionStorage.removeItem('ticketRole');
	sessionStorage.removeItem('ticketUser');
	sessionStorage.removeItem('ticketToken');
	location.href = '../Auth/index.html';
}

async function fetchTicketsApi(){
	const res = await fetch(`${API_URL}/tickets`, {
		headers: { 'Authorization': `Bearer ${authToken}` }
	});
	if (res.status === 401) { goToLoginExpired(); throw new Error('Session expired'); }
	if (!res.ok) throw new Error('API load failed');
	return res.json();
}

async function postTicketApi(ticket){
	const res = await fetch(`${API_URL}/tickets`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${authToken}`
		},
		body: JSON.stringify(ticket)
	});
	if (res.status === 401) { goToLoginExpired(); throw new Error('Session expired'); }
	if (!res.ok) throw new Error('API create failed');
	return res.json();
}

let usingFallback = false;
async function loadAllTickets(){
	try {
		const tickets = await fetchTicketsApi();
		usingFallback = false;
		return tickets;
	} catch (err) {
		console.warn(err);
		usingFallback = true;
		return loadTicketsLocal();
	}
}

async function saveTicket(ticket){
	try {
		return await postTicketApi(ticket);
	} catch (err) {
		console.warn(err);
		usingFallback = true;
		const tickets = loadTicketsLocal();
		tickets.push(ticket);
		saveTicketsLocal(tickets);
		return ticket;
	}
}

// Only the tickets submitted by the logged-in user
async function loadMyTickets(){
	const all = await loadAllTickets();
	return all.filter(tk => (tk.name || '').trim().toLowerCase() === username.trim().toLowerCase());
}

function generateId(length = 8){
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let id = '';
	for (let i = 0; i < length; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
	return id;
}

function isExpired(ticket){
	try {
		const created = new Date(ticket.createdAt).getTime();
		return (Date.now() - created) > 60_000; // 1 minute
	} catch (e) { return false; }
}

function statusOf(tk){
	if (tk.status === 'accepted') return 'accepted';
	if (tk.status === 'denied') return 'denied';
	if (isExpired(tk)) return 'expired';
	return 'sent';
}

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

// ── Dashboard ─────────────────────────────────────────────────────────────────
function computeCounts(tickets){
	const total = tickets.length;
	const accepted = tickets.filter(tk => tk.status === 'accepted').length;
	const denied = tickets.filter(tk => tk.status === 'denied').length;
	const sent = total - accepted - denied;
	return { total, sent, accepted, denied };
}

function generateSummary(tickets, counts){
	const { total, sent, accepted, denied } = counts;
	if (total === 0) {
		return `You haven't submitted any tickets yet. Once you do, a quick summary will show up here.`;
	}
	const plural = (n, w) => `${n} ${w}${n !== 1 ? 's' : ''}`;
	const recent = tickets.slice().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
	let s = `You've submitted <strong>${plural(total,'ticket')}</strong> so far — ${plural(sent,'ticket')} awaiting review, ${plural(accepted,'ticket')} accepted, and ${plural(denied,'ticket')} denied.`;
	if (recent) {
		s += ` Your most recent request is <strong>"${escapeHtml(recent.title)}"</strong>, submitted ${formatElapsed(recent.createdAt)}.`;
	}
	return s;
}

const CIRCUMFERENCE = 2 * Math.PI * 80;
function setArc(el, dashLen, dashOffset){
	if (!el) return;
	el.style.strokeDasharray = `${dashLen.toFixed(2)} ${(CIRCUMFERENCE - dashLen).toFixed(2)}`;
	el.style.strokeDashoffset = `-${dashOffset.toFixed(2)}`;
}

function renderDonut(counts){
	const { total, sent, accepted, denied } = counts;
	qs('#legend-sent').textContent = sent;
	qs('#legend-accepted').textContent = accepted;
	qs('#legend-denied').textContent = denied;
	qs('#donut-num').textContent = total;
	qs('#donut-label').textContent = total === 1 ? 'TICKET' : 'TOTAL';

	const arcSent = qs('#arc-sent'), arcAccepted = qs('#arc-accepted'), arcDenied = qs('#arc-denied');
	if (total === 0) {
		[arcSent, arcAccepted, arcDenied].forEach(el => { if (el) el.style.strokeDasharray = `0 ${CIRCUMFERENCE}`; });
		return;
	}
	const lenAccepted = (accepted/total) * CIRCUMFERENCE;
	const lenDenied = (denied/total) * CIRCUMFERENCE;
	const lenSent = (sent/total) * CIRCUMFERENCE;
	let offset = 0;
	setArc(arcAccepted, lenAccepted, offset); offset += lenAccepted;
	setArc(arcDenied, lenDenied, offset); offset += lenDenied;
	setArc(arcSent, lenSent, offset);
}

async function refreshDashboard(){
	const tickets = await loadMyTickets();
	const counts = computeCounts(tickets);
	qs('#stat-total').textContent = counts.total;
	qs('#stat-sent').textContent = counts.sent;
	qs('#stat-accepted').textContent = counts.accepted;
	qs('#stat-denied').textContent = counts.denied;
	renderDonut(counts);
	qs('#dashboard-text').innerHTML = generateSummary(tickets, counts);
}

// ── My Tickets list ───────────────────────────────────────────────────────────
let currentFilter = 'all';
let lastMyTickets = [];

qsa('.filter-tab').forEach(btn => {
	btn.addEventListener('click', () => {
		qsa('.filter-tab').forEach(b => b.classList.remove('active'));
		btn.classList.add('active');
		currentFilter = btn.dataset.filter;
		renderTicketList(lastMyTickets);
	});
});

function renderTicketList(tickets){
	lastMyTickets = tickets;
	const container = qs('#tickets-container');

	const counts = { all: tickets.length, sent: 0, accepted: 0, denied: 0, expired: 0 };
	tickets.forEach(tk => { counts[statusOf(tk)]++; });
	qs('#count-all').textContent = counts.all;
	qs('#count-sent').textContent = counts.sent;
	qs('#count-accepted').textContent = counts.accepted;
	qs('#count-denied').textContent = counts.denied;
	qs('#count-expired').textContent = counts.expired;

	const filtered = tickets.filter(tk => currentFilter === 'all' || statusOf(tk) === currentFilter);
	container.innerHTML = '';

	if (filtered.length === 0) {
		container.innerHTML = `<div class="ticket-empty">${tickets.length === 0 ? "You haven't submitted any tickets yet." : 'No tickets in this view.'}</div>`;
		return;
	}

	filtered
		.slice()
		.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
		.forEach(tk => container.appendChild(buildTicketCard(tk)));
}

function buildTicketCard(tk){
	const status = statusOf(tk);
	const statusLabel = { sent: 'Sent', accepted: 'Accepted', denied: 'Denied', expired: 'Expired' }[status];
	const priorityClass = (tk.priority === 'Urgent' || tk.priority === 'High') ? `priority-${tk.priority}` : '';

	const card = document.createElement('div');
	card.className = `ticket-card is-${status}`;
	card.dataset.created = tk.createdAt;
	card.innerHTML = `
		<div class="ticket-top">
			<span class="ticket-status">${statusLabel}</span>
			<span class="ticket-title">${escapeHtml(tk.title)}</span>
			<span class="ticket-priority ${priorityClass}">${escapeHtml(tk.priority)}</span>
		</div>
		<div class="ticket-meta">${escapeHtml(tk.department)}<span class="sep">·</span>ID ${escapeHtml(tk.id || '')}</div>
		${tk.topic ? `<div class="ticket-topic">${escapeHtml(tk.topic)}</div>` : ''}
		${tk.description ? `<div class="ticket-desc">${escapeHtml(tk.description)}</div>` : ''}
		<div class="ticket-timer">submitted ${formatElapsed(tk.createdAt)}</div>
	`;
	return card;
}

async function refreshTicketList(){
	const tickets = await loadMyTickets();
	renderTicketList(tickets);
}

// Live elapsed-time refresh without a full re-fetch
setInterval(() => {
	qsa('.ticket-card').forEach(card => {
		const created = card.dataset.created;
		const timerEl = card.querySelector('.ticket-timer');
		if (created && timerEl) timerEl.textContent = `submitted ${formatElapsed(created)}`;
	});
}, 1000);

// ── Submit form ───────────────────────────────────────────────────────────────
const ticketForm = qs('#ticket-form');
const submitBtn = qs('#submit-btn');
const sentBanner = qs('#sent-banner');

function setSubmitLoading(isLoading){
	submitBtn.disabled = isLoading;
	submitBtn.querySelector('.btn-label').classList.toggle('hidden', isLoading);
	submitBtn.querySelector('.btn-spinner').classList.toggle('hidden', !isLoading);
}

ticketForm.addEventListener('submit', async (e) => {
	e.preventDefault();
	sentBanner.classList.add('hidden');

	const data = {
		id: generateId(),
		name: username,
		department: qs('#department').value,
		priority: qs('#priority').value,
		topic: qs('#topic').value.trim(),
		title: qs('#title').value.trim(),
		description: qs('#description').value.trim(),
		createdAt: new Date().toISOString(),
		status: 'pending'
	};

	setSubmitLoading(true);
	try {
		await saveTicket(data);
		ticketForm.reset();
		qs('#name').value = username;
		sentBanner.classList.remove('hidden');
	} finally {
		setSubmitLoading(false);
	}
});

// ── Initial render ───────────────────────────────────────────────────────────
showView('dashboard');
