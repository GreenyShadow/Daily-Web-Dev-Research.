// ── Auth guard: only logged-in Admins may view this page ────────────────────
if (sessionStorage.getItem('ticketRole') !== 'admin') {
	location.href = '../Auth/index.html';
}

// Admin Console logic
const qs = s => document.querySelector(s);
const qsa = s => Array.from(document.querySelectorAll(s));
const API_URL = 'http://localhost:3000';

let currentFilter = 'all';
let currentView = 'overview';

// ── Data layer (same source as Member UI: API first, localStorage fallback) ──
function loadTicketsLocal(){
	try { return JSON.parse(localStorage.getItem('tickets') || '[]'); }
	catch (e) { return []; }
}
function saveTicketsLocal(tickets){
	localStorage.setItem('tickets', JSON.stringify(tickets));
}

async function fetchTicketsApi(){
	const res = await fetch(`${API_URL}/tickets`);
	if(!res.ok) throw new Error('API load failed');
	return res.json();
}

async function patchTicketApi(id, updates){
	const res = await fetch(`${API_URL}/tickets/${encodeURIComponent(id)}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(updates)
	});
	if(!res.ok) throw new Error('API update failed');
	return res.json();
}

async function loadTickets(){
	try {
		return await fetchTicketsApi();
	} catch (err) {
		console.warn(err);
		return loadTicketsLocal();
	}
}

async function updateTicketStatus(id, status){
	try {
		return await patchTicketApi(id, { status: status || '' });
	} catch (err) {
		console.warn(err);
		const tickets = loadTicketsLocal();
		const ticket = tickets.find(item => item.id === id);
		if (!ticket) throw err;
		if (status) ticket.status = status;
		else delete ticket.status;
		saveTicketsLocal(tickets);
		return ticket;
	}
}

function isExpired(ticket){
	try{
		const created = new Date(ticket.createdAt).getTime();
		return (Date.now() - created) > 60_000; // 1 minute, matches Member UI
	}catch(e){ return false; }
}

function escapeHtml(str){
	if(!str) return '';
	return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatElapsed(iso){
	const created = new Date(iso).getTime();
	const diff = Math.max(0, Math.floor((Date.now() - created)/1000));
	if(isNaN(diff)) return '0s';
	if(diff < 60) return `${diff}s ago`;
	if(diff < 3600){
		const m = Math.floor(diff/60), s = diff % 60;
		return `${m}m ${s}s ago`;
	}
	if(diff < 86400){
		const h = Math.floor(diff/3600), m = Math.floor((diff%3600)/60);
		return `${h}h ${m}m ago`;
	}
	const d = Math.floor(diff/86400), h = Math.floor((diff%86400)/3600);
	return `${d}d ${h}h ago`;
}

function statusOf(tk){
	if(tk.status === 'accepted') return 'accepted';
	if(tk.status === 'denied') return 'denied';
	if(isExpired(tk)) return 'expired';
	return 'sent';
}

// ── View switching ──────────────────────────────────────────────────────────
qsa('.rail-btn').forEach(btn=>{
	btn.addEventListener('click', ()=>{
		qsa('.rail-btn').forEach(b=>b.classList.remove('active'));
		btn.classList.add('active');
		currentView = btn.dataset.view;
		qs('#view-overview').classList.toggle('hidden', currentView !== 'overview');
		qs('#view-queue').classList.toggle('hidden', currentView !== 'queue');
	});
});

qsa('.filter-tab').forEach(btn=>{
	btn.addEventListener('click', ()=>{
		qsa('.filter-tab').forEach(b=>b.classList.remove('active'));
		btn.classList.add('active');
		currentFilter = btn.dataset.filter;
		refreshAll(false);
	});
});

const logoutBtn = qs('#admin-logout');
if(logoutBtn) logoutBtn.addEventListener('click', ()=>{
	sessionStorage.removeItem('ticketRole');
	sessionStorage.removeItem('ticketUser');
	location.href = '../Auth/index.html';
});

// ── Clock ─────────────────────────────────────────────────────────────────
function tickClock(){
	const el = qs('#admin-clock');
	if(!el) return;
	const now = new Date();
	el.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(tickClock, 1000);
tickClock();

// ── Daily brief copy (template-based, admin voice) ──────────────────────────
function generateAdminBrief(tickets, counts){
	const { total, sent, accepted, denied, expired } = counts;
	if(total === 0){
		return 'No requests have been submitted yet. This brief will populate once tickets start arriving.';
	}

	const urgentHigh = tickets.filter(tk => tk.priority === 'Urgent' || tk.priority === 'High').length;

	const byDept = {};
	tickets.forEach(tk => {
		const d = tk.department || 'Unknown';
		byDept[d] = (byDept[d] || 0) + 1;
	});
	const topDept = Object.entries(byDept).sort((a,b)=>b[1]-a[1])[0];

	const plural = (n, w) => `${n} ${w}${n !== 1 ? 's' : ''}`;

	let s = `<strong>${plural(total,'request')}</strong> are on record, with <strong>${plural(sent,'request')}</strong> awaiting a decision`;
	if(expired > 0){
		s += ` — <strong>${plural(expired,'request')}</strong> ${expired !== 1 ? 'have' : 'has'} run past the one-minute response window and ${expired !== 1 ? 'need' : 'needs'} attention`;
	}
	s += `. ${urgentHigh > 0 ? `${plural(urgentHigh,'request')} carry Urgent or High priority. ` : ''}`;
	if(topDept){
		s += `${topDept[0]} has filed the most requests (${topDept[1]}). `;
	}
	s += `So far, <strong>${plural(accepted,'request')}</strong> ${accepted !== 1 ? 'have' : 'has'} been accepted and <strong>${plural(denied,'request')}</strong> denied.`;
	return s;
}

// ── Donut chart ──────────────────────────────────────────────────────────────
const CIRCUMFERENCE = 2 * Math.PI * 80;

function setArc(el, dashLen, dashOffset){
	if(!el) return;
	el.style.strokeDasharray  = `${dashLen.toFixed(2)} ${(CIRCUMFERENCE - dashLen).toFixed(2)}`;
	el.style.strokeDashoffset = `-${dashOffset.toFixed(2)}`;
}

function renderDonut(counts){
	const { total, sent, accepted, denied, expired } = counts;

	qs('#legend-sent').textContent = sent;
	qs('#legend-accepted').textContent = accepted;
	qs('#legend-denied').textContent = denied;
	qs('#legend-expired').textContent = expired;
	qs('#adm-donut-num').textContent = total;
	qs('#adm-donut-label').textContent = total === 1 ? 'TICKET' : 'TOTAL';

	const arcAccepted = qs('#adm-arc-accepted');
	const arcDenied   = qs('#adm-arc-denied');
	const arcExpired  = qs('#adm-arc-expired');
	const arcSent     = qs('#adm-arc-sent');

	if(total === 0){
		[arcAccepted, arcDenied, arcExpired, arcSent].forEach(el => {
			if(el) el.style.strokeDasharray = `0 ${CIRCUMFERENCE}`;
		});
		return;
	}

	// Sent here = awaiting and not yet expired
	const awaitingActive = Math.max(0, sent - expired);

	const lenAccepted = (accepted / total) * CIRCUMFERENCE;
	const lenDenied   = (denied   / total) * CIRCUMFERENCE;
	const lenExpired  = (expired  / total) * CIRCUMFERENCE;
	const lenSent     = (awaitingActive / total) * CIRCUMFERENCE;

	let offset = 0;
	setArc(arcAccepted, lenAccepted, offset); offset += lenAccepted;
	setArc(arcDenied,   lenDenied,   offset); offset += lenDenied;
	setArc(arcExpired,  lenExpired,  offset); offset += lenExpired;
	setArc(arcSent,      lenSent,    offset);
}

// ── Stats / counts ───────────────────────────────────────────────────────────
function computeCounts(tickets){
	const total = tickets.length;
	const accepted = tickets.filter(tk => tk.status === 'accepted').length;
	const denied   = tickets.filter(tk => tk.status === 'denied').length;
	const expired  = tickets.filter(tk => isExpired(tk) && (!tk.status || tk.status === '')).length;
	const sent     = total - accepted - denied; // includes expired-but-unresolved
	return { total, sent, accepted, denied, expired };
}

function renderStats(counts){
	qs('#stat-total').textContent = counts.total;
	qs('#stat-sent').textContent = counts.sent;
	qs('#stat-accepted').textContent = counts.accepted;
	qs('#stat-denied').textContent = counts.denied;
	qs('#stat-expired').textContent = counts.expired;
	qs('#pending-pill').textContent = `${counts.sent} awaiting review`;

	qs('#count-all').textContent = counts.total;
	qs('#count-sent').textContent = counts.sent - counts.expired;
	qs('#count-accepted').textContent = counts.accepted;
	qs('#count-denied').textContent = counts.denied;
	qs('#count-expired').textContent = counts.expired;
}

// ── Ledger (ticket queue) ────────────────────────────────────────────────────
function buildLedgerRow(tk){
	const status = statusOf(tk);
	const row = document.createElement('div');
	row.className = `ledger-row is-${status}`;
	row.dataset.created = tk.createdAt;
	row.dataset.tid = tk.id || '';

	const priorityClass = (tk.priority === 'Urgent' || tk.priority === 'High') ? `priority-${tk.priority}` : '';

	row.innerHTML = `
		<div class="ledger-main">
			<div class="ledger-top">
				<span class="ledger-title">${escapeHtml(tk.title)}</span>
				<span class="ledger-id">#${escapeHtml(tk.id || '')}</span>
				<span class="ledger-priority ${priorityClass}">${escapeHtml(tk.priority)}</span>
			</div>
			<div class="ledger-meta">${escapeHtml(tk.name)}<span class="sep">·</span>${escapeHtml(tk.department)}</div>
			${tk.topic ? `<div class="ledger-topic">${escapeHtml(tk.topic)}</div>` : ''}
			${tk.description ? `<div class="ledger-desc">${escapeHtml(tk.description)}</div>` : ''}
			<div class="ledger-elapsed">submitted ${escapeHtml(formatElapsed(tk.createdAt))}</div>
		</div>
		<div class="ledger-actions"></div>
	`;

	const actions = row.querySelector('.ledger-actions');

	if(status === 'accepted'){
		const stamp = document.createElement('div');
		stamp.className = 'stamp stamp-accepted';
		stamp.textContent = 'Approved';
		const reopen = document.createElement('button');
		reopen.className = 'act-btn act-reopen';
		reopen.textContent = 'Reopen';
		reopen.addEventListener('click', async ()=>{
			await updateTicketStatus(tk.id, '');
			refreshAll(true);
		});
		actions.appendChild(stamp);
		actions.appendChild(reopen);
	} else if(status === 'denied'){
		const stamp = document.createElement('div');
		stamp.className = 'stamp stamp-denied';
		stamp.textContent = 'Declined';
		const reopen = document.createElement('button');
		reopen.className = 'act-btn act-reopen';
		reopen.textContent = 'Reopen';
		reopen.addEventListener('click', async ()=>{
			await updateTicketStatus(tk.id, '');
			refreshAll(true);
		});
		actions.appendChild(stamp);
		actions.appendChild(reopen);
	} else {
		const approveBtn = document.createElement('button');
		approveBtn.className = 'act-btn act-approve';
		approveBtn.textContent = 'Approve';
		approveBtn.addEventListener('click', async ()=>{
			await updateTicketStatus(tk.id, 'accepted');
			refreshAll(true);
		});
		const declineBtn = document.createElement('button');
		declineBtn.className = 'act-btn act-decline';
		declineBtn.textContent = 'Decline';
		declineBtn.addEventListener('click', async ()=>{
			await updateTicketStatus(tk.id, 'denied');
			refreshAll(true);
		});
		actions.appendChild(approveBtn);
		actions.appendChild(declineBtn);
	}

	return row;
}

function renderLedger(tickets){
	const ledger = qs('#ledger');
	ledger.innerHTML = '';

	const filtered = tickets.filter(tk => currentFilter === 'all' || statusOf(tk) === currentFilter);

	if(filtered.length === 0){
		ledger.innerHTML = '<div class="ledger-empty">No tickets in this view.</div>';
		return;
	}

	filtered
		.slice()
		.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
		.forEach(tk => ledger.appendChild(buildLedgerRow(tk)));
}

// ── Live elapsed-time refresh (no full re-fetch) ────────────────────────────
function updateElapsedLabels(){
	qsa('.ledger-row').forEach(row=>{
		const created = row.dataset.created;
		const elapsedEl = row.querySelector('.ledger-elapsed');
		if(created && elapsedEl) elapsedEl.textContent = `submitted ${formatElapsed(created)}`;
	});
}
setInterval(updateElapsedLabels, 1000);

// ── Master refresh ───────────────────────────────────────────────────────────
let lastTickets = [];

async function refreshAll(refetch){
	if(refetch !== false){
		lastTickets = await loadTickets();
	}
	const counts = computeCounts(lastTickets);
	renderStats(counts);
	renderDonut(counts);
	qs('#admin-brief').innerHTML = generateAdminBrief(lastTickets, counts);
	renderLedger(lastTickets);
}

// Poll periodically so new Member-submitted tickets show up automatically
setInterval(()=> refreshAll(true), 5000);

refreshAll(true);
