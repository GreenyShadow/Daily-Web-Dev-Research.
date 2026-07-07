// ── Auth guard: only logged-in Admins may view this page ────────────────────
if (sessionStorage.getItem('ticketRole') !== 'admin') {
	location.href = '../Auth/index.html';
}

// Admin Console logic
const qs = s => document.querySelector(s);
const qsa = s => Array.from(document.querySelectorAll(s));
const API_URL = 'http://localhost:3000';
const authToken = sessionStorage.getItem('ticketToken');

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
	if(res.status === 401) { goToLoginExpired(); throw new Error('Session expired'); }
	if(!res.ok) throw new Error('API load failed');
	return res.json();
}

async function patchTicketApi(id, updates){
	const res = await fetch(`${API_URL}/tickets/${encodeURIComponent(id)}`, {
		method: 'PATCH',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${authToken}`
		},
		body: JSON.stringify(updates)
	});
	if(res.status === 401) { goToLoginExpired(); throw new Error('Session expired'); }
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

async function updateTicketStatus(id, status, extra = {}){
	try {
		return await patchTicketApi(id, { status: status || '', ...extra });
	} catch (err) {
		console.warn(err);
		const tickets = loadTicketsLocal();
		const ticket = tickets.find(item => item.id === id);
		if (!ticket) throw err;
		if (status) ticket.status = status;
		else delete ticket.status;
		Object.assign(ticket, extra);
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

// Once a ticket is approved it may move on through the support pipeline
// (in_progress / resolved / closed) as an Agent works it — all of those
// still count as "accepted" for the admin queue/filter, since the admin's
// decision on it hasn't changed. See ledger-stage badge for the live detail.
const SUPPORT_STAGE_STATUSES = ['accepted', 'in_progress', 'resolved', 'closed'];

function statusOf(tk){
	if(SUPPORT_STAGE_STATUSES.includes(tk.status)) return 'accepted';
	if(tk.status === 'denied') return 'denied';
	if(isExpired(tk)) return 'expired';
	return 'sent';
}

const STAGE_LABELS = { accepted: 'In queue', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' };

// ── Auto-Triage (rule-based, no AI) ─────────────────────────────────────────
// Deterministic checks only. Anything that doesn't clearly match a rule is
// left untouched for a human to review — this only ever auto-DENIES, never
// auto-accepts, so it can't wrongly approve something on its own.
const ALLOWED_DEPARTMENTS = ['Design', 'UI', 'Security'];

const SPAM_KEYWORDS = [
	'test', 'testing', 'asdf', 'qwerty', 'lorem ipsum', 'sample',
	'placeholder', 'n/a', 'xxx', '1234', 'foo bar'
];

// Modest blacklist: common profanity + phrases that frame the company
// negatively (defamatory/reputational risk). Not exhaustive by design —
// ambiguous cases fall through to manual review rather than guessing.
const REPUTATION_KEYWORDS = [
	'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'idiot', 'moron',
	'scam', 'fraud', 'sue you', 'lawsuit', 'terrible company',
	'worst company', 'hate this company', 'going to the press',
	'report you', 'expose you'
];

function containsWord(haystack, phrase){
	const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const re = new RegExp(`\\b${escaped}\\b`, 'i');
	return re.test(haystack);
}

// Returns a human-readable denial reason string, or null if the ticket
// doesn't trip any rule (meaning: leave it for manual review).
function autoTriageDecision(tk){
	const title = (tk.title || '').trim();
	const description = (tk.description || '').trim();
	const department = (tk.department || '').trim();
	const combined = `${title} ${description}`;

	if (title.length < 3 || description.length < 5){
		return 'Title or description is empty/too short to act on';
	}
	if (!ALLOWED_DEPARTMENTS.includes(department)){
		return `Department "${department || '(blank)'}" isn't a recognized team`;
	}
	for (const kw of SPAM_KEYWORDS){
		if (containsWord(combined, kw)) return `Looks like placeholder/spam content ("${kw}")`;
	}
	for (const kw of REPUTATION_KEYWORDS){
		if (containsWord(combined, kw)) return 'Contains inappropriate or reputation-damaging language';
	}
	return null;
}

async function runAutoTriage(){
	const btn = qs('#auto-triage-btn');
	const summaryEl = qs('#auto-triage-summary');
	btn.disabled = true;
	btn.textContent = 'Running…';
	summaryEl.classList.add('hidden');

	// Only tickets with no decision yet — never touch accepted/denied ones.
	const pending = lastTickets.filter(tk => tk.status !== 'accepted' && tk.status !== 'denied');

	let deniedCount = 0;
	const deniedList = [];
	for (const tk of pending){
		const reason = autoTriageDecision(tk);
		if (!reason) continue;
		try {
			await patchTicketApi(tk.id, { status: 'denied', triageNote: `Auto-denied: ${reason}` });
			deniedCount++;
			deniedList.push({ title: tk.title, reason });
		} catch (err){
			console.warn('Auto-triage failed for', tk.id, err);
		}
	}

	btn.disabled = false;
	btn.textContent = 'Run Auto-Triage';
	summaryEl.classList.remove('hidden');

	if (pending.length === 0){
		summaryEl.innerHTML = `<strong>Auto-Triage:</strong> nothing awaiting review right now.`;
	} else if (deniedCount === 0){
		summaryEl.innerHTML = `<strong>Auto-Triage complete.</strong> Checked ${pending.length} pending ticket${pending.length !== 1 ? 's' : ''} — none matched a denial rule.`;
	} else {
		const items = deniedList.map(d => `<li>"${escapeHtml(d.title)}" — ${escapeHtml(d.reason)}</li>`).join('');
		summaryEl.innerHTML = `<strong>Auto-Triage complete.</strong> Auto-denied ${deniedCount} of ${pending.length} pending ticket${pending.length !== 1 ? 's' : ''}:<ul>${items}</ul>`;
	}

	await refreshAll(true);
}

qs('#auto-triage-btn').addEventListener('click', runAutoTriage);

// ── View switching ──────────────────────────────────────────────────────────
qsa('.rail-btn').forEach(btn=>{
	btn.addEventListener('click', ()=>{
		qsa('.rail-btn').forEach(b=>b.classList.remove('active'));
		btn.classList.add('active');
		currentView = btn.dataset.view;
		qs('#view-overview').classList.toggle('hidden', currentView !== 'overview');
		qs('#view-queue').classList.toggle('hidden', currentView !== 'queue');
		qs('#view-users').classList.toggle('hidden', currentView !== 'users');
		if (currentView === 'users') refreshUsers();
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

let searchTerm = '';
const ticketSearchInput = qs('#ticket-search');
if (ticketSearchInput) {
	ticketSearchInput.addEventListener('input', () => {
		searchTerm = ticketSearchInput.value.trim().toLowerCase();
		refreshAll(false);
	});
}

function matchesSearch(tk, term){
	if (!term) return true;
	const haystack = [tk.title, tk.description, tk.topic, tk.name, tk.department, tk.id]
		.filter(Boolean)
		.join(' ')
		.toLowerCase();
	return haystack.includes(term);
}

const logoutBtn = qs('#admin-logout');
if(logoutBtn) logoutBtn.addEventListener('click', ()=>{
	sessionStorage.removeItem('ticketRole');
	sessionStorage.removeItem('ticketUser');
	sessionStorage.removeItem('ticketToken');
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
	const expired  = tickets.filter(tk => isExpired(tk) && (!tk.status || tk.status === 'pending')).length;
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
			${tk.triageNote ? `<div class="triage-note">${escapeHtml(tk.triageNote)}</div>` : ''}
			${status === 'accepted' && tk.status !== 'accepted' ? `<div class="stage-note">${escapeHtml(STAGE_LABELS[tk.status] || tk.status)}${tk.assignedTo ? ` · assigned to ${escapeHtml(tk.assignedTo)}` : ''}</div>` : ''}
			${status === 'accepted' && tk.status === 'accepted' && tk.assignedTo ? `<div class="stage-note">assigned to ${escapeHtml(tk.assignedTo)}</div>` : ''}
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
			await updateTicketStatus(tk.id, '', { triageNote: '' });
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
			await updateTicketStatus(tk.id, '', { triageNote: '' });
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

	const filtered = tickets.filter(tk =>
		(currentFilter === 'all' || statusOf(tk) === currentFilter) && matchesSearch(tk, searchTerm)
	);

	if(filtered.length === 0){
		ledger.innerHTML = '<div class="ledger-empty">No tickets match this view.</div>';
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

// ── User management ─────────────────────────────────────────────────────────
const currentUsername = sessionStorage.getItem('ticketUser') || '';

async function fetchUsersApi(){
	const res = await fetch(`${API_URL}/users`, {
		headers: { 'Authorization': `Bearer ${authToken}` }
	});
	if(res.status === 401) { goToLoginExpired(); throw new Error('Session expired'); }
	if(!res.ok) throw new Error('Could not load users');
	return res.json();
}

async function createUserApi(user){
	const res = await fetch(`${API_URL}/users`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
		body: JSON.stringify(user)
	});
	if(res.status === 401) { goToLoginExpired(); throw new Error('Session expired'); }
	if(!res.ok){
		const body = await res.json().catch(()=>({}));
		throw new Error(body.error || 'Could not create user');
	}
	return res.json();
}

async function patchUserApi(username, updates){
	const res = await fetch(`${API_URL}/users/${encodeURIComponent(username)}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
		body: JSON.stringify(updates)
	});
	if(res.status === 401) { goToLoginExpired(); throw new Error('Session expired'); }
	if(!res.ok){
		const body = await res.json().catch(()=>({}));
		throw new Error(body.error || 'Could not update user');
	}
	return res.json();
}

async function deleteUserApi(username){
	const res = await fetch(`${API_URL}/users/${encodeURIComponent(username)}`, {
		method: 'DELETE',
		headers: { 'Authorization': `Bearer ${authToken}` }
	});
	if(res.status === 401) { goToLoginExpired(); throw new Error('Session expired'); }
	if(!res.ok){
		const body = await res.json().catch(()=>({}));
		throw new Error(body.error || 'Could not delete user');
	}
}

function buildUserRow(user){
	const row = document.createElement('div');
	row.className = 'user-row';

	const isSelf = user.username === currentUsername;

	row.innerHTML = `
		<div class="user-cell user-cell-name">
			<span class="user-name">${escapeHtml(user.username)}</span>
			${isSelf ? '<span class="you-badge">you</span>' : ''}
		</div>
		<div class="user-cell user-cell-role"></div>
		<div class="user-cell user-cell-actions"></div>
	`;

	const roleCell = row.querySelector('.user-cell-role');
	const roleSelect = document.createElement('select');
	roleSelect.className = 'user-role-select';
	['member', 'agent', 'admin'].forEach(r => {
		const opt = document.createElement('option');
		opt.value = r;
		opt.textContent = r.charAt(0).toUpperCase() + r.slice(1);
		if (r === user.role) opt.selected = true;
		roleSelect.appendChild(opt);
	});
	roleSelect.addEventListener('change', async () => {
		const newRole = roleSelect.value;
		try {
			await patchUserApi(user.username, { role: newRole });
			await refreshUsers();
		} catch (err) {
			alert(err.message || 'Could not update role');
			roleSelect.value = user.role;
		}
	});
	roleCell.appendChild(roleSelect);

	const actionsCell = row.querySelector('.user-cell-actions');

	const resetBtn = document.createElement('button');
	resetBtn.className = 'chip-btn chip-reset';
	resetBtn.textContent = 'Reset password';
	resetBtn.addEventListener('click', async () => {
		const newPassword = prompt(`New password for ${user.username}:`);
		if (!newPassword) return;
		try {
			await patchUserApi(user.username, { password: newPassword });
			alert(`Password updated for ${user.username}.`);
		} catch (err) {
			alert(err.message || 'Could not reset password');
		}
	});
	actionsCell.appendChild(resetBtn);

	const deleteBtn = document.createElement('button');
	deleteBtn.className = 'chip-btn chip-delete';
	deleteBtn.textContent = 'Delete';
	deleteBtn.disabled = isSelf;
	deleteBtn.title = isSelf ? "You can't delete the account you're logged in as" : '';
	deleteBtn.addEventListener('click', async () => {
		if (!confirm(`Delete the account "${user.username}"? This can't be undone.`)) return;
		try {
			await deleteUserApi(user.username);
			await refreshUsers();
		} catch (err) {
			alert(err.message || 'Could not delete user');
		}
	});
	actionsCell.appendChild(deleteBtn);

	return row;
}

function renderUserTable(users){
	const table = qs('#user-table');
	table.innerHTML = '';

	if (users.length === 0){
		table.innerHTML = '<div class="ledger-empty">No accounts yet.</div>';
		return;
	}

	const header = document.createElement('div');
	header.className = 'user-row user-row-head';
	header.innerHTML = `
		<div class="user-cell user-cell-name">Username</div>
		<div class="user-cell user-cell-role">Role</div>
		<div class="user-cell user-cell-actions">Actions</div>
	`;
	table.appendChild(header);

	users
		.slice()
		.sort((a,b) => a.username.localeCompare(b.username))
		.forEach(user => table.appendChild(buildUserRow(user)));
}

async function refreshUsers(){
	try {
		const users = await fetchUsersApi();
		renderUserTable(users);
	} catch (err) {
		console.warn(err);
		qs('#user-table').innerHTML = '<div class="ledger-empty">Could not load users — is the API running?</div>';
	}
}

const userForm = qs('#user-form');
const userFormError = qs('#user-form-error');
if (userForm) {
	userForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		userFormError.classList.add('hidden');
		const submitBtn = qs('#user-form-submit');
		submitBtn.disabled = true;
		try {
			await createUserApi({
				username: qs('#user-username').value.trim(),
				password: qs('#user-password').value,
				role: qs('#user-role').value
			});
			userForm.reset();
			await refreshUsers();
		} catch (err) {
			userFormError.textContent = err.message || 'Could not create user';
			userFormError.classList.remove('hidden');
		} finally {
			submitBtn.disabled = false;
		}
	});
}

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
