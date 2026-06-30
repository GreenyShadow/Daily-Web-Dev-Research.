// ── Auth guard: only logged-in Members may view this page ───────────────────
if (sessionStorage.getItem('ticketRole') !== 'member') {
	location.href = '../Auth/index.html';
}

// Simple single-file app logic
const qs = s => document.querySelector(s);
const API_URL = 'http://localhost:3000';
const managerView = qs('#manager-view');
const submitterView = qs('#submitter-view');
const navDashboard = qs('#nav-dashboard');
const navSubmit = qs('#nav-submit');
const sideMy = qs('#side-my');
const dashboardText = qs('#dashboard-text');
const myTicketsEl = qs('#my-tickets');
const myTicketView = qs('#my-ticket-view');
const dashboardView = qs('#dashboard-view');
const managerHeading = qs('#manager-heading');
const ticketsContainer = qs('#tickets-container');
const sideB = qs('#side-b');
const sideC = qs('#side-c');
const navLogout = qs('#nav-logout');

// ── Dashboard summary generator ──────────────────────────────────────
// Reads all tickets from storage and builds a natural-language paragraph
// using template strings filled with real counts and labels.

function generateDashboardSummary(tickets) {
	const total = tickets.length;

	if (total === 0) {
		return 'No tickets have been submitted yet. Once your team starts submitting tickets, a summary of activity will appear here automatically.';
	}

	// --- counts by priority ---
	const priorityOrder = ['Urgent', 'High', 'Mid', 'Low'];
	const byPriority = {};
	priorityOrder.forEach(p => { byPriority[p] = 0; });
	tickets.forEach(tk => {
		const p = tk.priority || 'Low';
		byPriority[p] = (byPriority[p] || 0) + 1;
	});

	// --- counts by department ---
	const byDept = {};
	tickets.forEach(tk => {
		const d = tk.department || 'Unknown';
		byDept[d] = (byDept[d] || 0) + 1;
	});
	const topDept = Object.entries(byDept).sort((a,b) => b[1]-a[1]);

	// --- counts by status ---
	const accepted = tickets.filter(tk => tk.status === 'accepted').length;
	const denied   = tickets.filter(tk => tk.status === 'denied').length;
	const pending  = tickets.filter(tk => !tk.status || tk.status === 'pending').length;
	const expired  = tickets.filter(tk => isExpired(tk) && (!tk.status || tk.status === 'pending')).length;

	// --- most-used topic ---
	const topicCount = {};
	tickets.forEach(tk => {
		const t = (tk.topic || '').trim();
		if (t) topicCount[t] = (topicCount[t] || 0) + 1;
	});
	const topTopics = Object.entries(topicCount).sort((a,b) => b[1]-a[1]);

	// --- helpers ---
	const plural = (n, word) => `${n} ${word}${n !== 1 ? 's' : ''}`;

	const urgentHigh = (byPriority['Urgent'] || 0) + (byPriority['High'] || 0);
	const urgentHighLabel = urgentHigh > 0
		? `${plural(urgentHigh, 'ticket')} marked as Urgent or High priority`
		: 'no tickets flagged as Urgent or High priority';

	const deptSentence = topDept.length > 0
		? `The most active department is <strong>${topDept[0][0]}</strong> with ${plural(topDept[0][1], 'ticket')}${topDept.length > 1 ? `, followed by ${topDept.slice(1).map(([d,c]) => `${d} (${c})`).join(', ')}` : ''}.`
		: '';

	const topicSentence = topTopics.length > 0
		? ` The most common topic is <em>"${topTopics[0][0]}"</em>${topTopics[0][1] > 1 ? ` appearing ${topTopics[0][1]} times` : ''}.`
		: '';

	const statusSentence = `Of these, ${plural(accepted, 'ticket')} ${accepted !== 1 ? 'have' : 'has'} been accepted, ${plural(denied, 'ticket')} denied, and ${plural(pending, 'ticket')} ${pending !== 1 ? 'are' : 'is'} still marked as sent${expired > 0 ? ` (${expired} of which ${expired !== 1 ? 'have' : 'has'} expired while awaiting a response)` : ''}.`;

	const recentTicket = tickets.slice().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
	const recentSentence = recentTicket
		? ` The most recently submitted ticket is <strong>"${escapeHtml(recentTicket.title)}"</strong> from ${escapeHtml(recentTicket.name)} in ${escapeHtml(recentTicket.department)}.`
		: '';

	return `There ${total !== 1 ? 'are' : 'is'} currently <strong>${plural(total, 'ticket')}</strong> in the system, with ${urgentHighLabel}. ${deptSentence}${topicSentence} ${statusSentence}${recentSentence}`;
}

async function refreshDashboardSummary() {
	const tickets = await loadTickets();
	dashboardText.innerHTML = `<p>${generateDashboardSummary(tickets)}</p>`;
}
// ─────────────────────────────────────────────────────────────────────────────

function showManager(showTickets=false){
	managerView.classList.remove('hidden');
	submitterView.classList.add('hidden');
	if(showTickets){
		// My Ticket: show summary + chart + ticket list
		if(managerHeading) managerHeading.textContent = 'Summary';
		myTicketView.classList.remove('hidden');
		dashboardView.classList.add('hidden');
		refreshDashboardSummary();
		renderDonutChart();
		renderTickets();
	} else {
		// Dashboard: plain view, no summary, no chart
		if(managerHeading) managerHeading.textContent = 'Dashboard';
		myTicketView.classList.add('hidden');
		dashboardView.classList.remove('hidden');
	}
}

function showSubmitter(){
	submitterView.classList.remove('hidden');
	managerView.classList.add('hidden');
}

function setActiveSide(idOrEl){
	// clear all
	document.querySelectorAll('.side .side-btn').forEach(b=>b.classList.remove('active'));
	if(!idOrEl) return;
	let el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
	if(el) el.classList.add('active');
}

navDashboard.addEventListener('click', ()=>{ showManager(false); setActiveSide(null); });
navSubmit.addEventListener('click', ()=>{ showSubmitter(); setActiveSide(null); });
sideMy.addEventListener('click', ()=>{ showManager(true); setActiveSide('side-my'); });
if(sideB) sideB.addEventListener('click', ()=>{ showManager(false); setActiveSide('side-b'); });
if(sideC) sideC.addEventListener('click', ()=>{ showSubmitter(); setActiveSide('side-c'); });
if(navLogout) navLogout.addEventListener('click', ()=>{
	sessionStorage.removeItem('ticketRole');
	sessionStorage.removeItem('ticketUser');
	location.href = '../Auth/index.html';
});
// no selection popup — allow browser extensions to handle text selection

// Tickets storage helpers
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

async function postTicketApi(ticket){
	const res = await fetch(`${API_URL}/tickets`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(ticket)
	});
	if(!res.ok) throw new Error('API create failed');
	return res.json();
}

function formatApiError(err){
	console.warn(err);
	dashboardText.classList.remove('hidden');
	dashboardText.textContent = 'Could not reach API; using local browser storage instead.';
}

async function loadTickets(){
	try {
		return await fetchTicketsApi();
	} catch (err) {
		formatApiError(err);
		return loadTicketsLocal();
	}
}

async function saveTicket(ticket){
	try {
		return await postTicketApi(ticket);
	} catch (err) {
		formatApiError(err);
		const tickets = loadTicketsLocal();
		tickets.push(ticket);
		saveTicketsLocal(tickets);
		return ticket;
	}
}

// Generate a random ID made of 5 segments (mix of letters or numbers)
function generateId(length = 8){
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let id = '';
	for(let i=0;i<length;i++) id += chars.charAt(Math.floor(Math.random()*chars.length));
	return id;
}

function isExpired(ticket){
	try{
		const created = new Date(ticket.createdAt).getTime();
		return (Date.now() - created) > 60_000; // 1 minute
	}catch(e){return false}
}

async function renderTickets(){
	const tickets = await loadTickets();
	ticketsContainer.innerHTML = '';
	if(tickets.length===0){ ticketsContainer.innerHTML = '<div>No tickets submitted yet.</div>'; return }
	tickets.slice().reverse().forEach((tk)=>{
		const el = document.createElement('div'); el.className='ticket';
		const expired = isExpired(tk);
		if(tk.status === 'accepted') el.classList.add('accepted');
		else if(tk.status === 'denied') el.classList.add('denied');
		else if(expired) el.classList.add('expired');

		const statusLabel = tk.status === 'accepted' ? 'Accepted'
			: tk.status === 'denied' ? 'Denied'
			: expired ? 'Expired'
			: 'Sent';

		el.innerHTML = `<span class="ticket-status">${statusLabel}</span>
		<strong class="ticket-title">${escapeHtml(tk.title)}</strong>
		<div class="ticket-priority">${escapeHtml(tk.priority)}</div>
		<div class="ticket-id">ID: ${escapeHtml(tk.id || '')}</div>
		<div class="ticket-timer">${escapeHtml(formatElapsed(tk.createdAt))}</div>
		<div><em>${escapeHtml(tk.topic||'')}</em></div>
		<div class="ticket-desc">${escapeHtml(tk.description||'')}</div>
		<div class="ticket-meta">By ${escapeHtml(tk.name)} — ${escapeHtml(tk.department)}</div>`;
		el.dataset.created = tk.createdAt;
		el.dataset.tid = tk.id || '';

		ticketsContainer.appendChild(el);
	});
}

// Format elapsed time since ISO date string
function formatElapsed(iso){
	const created = new Date(iso).getTime();
	const diff = Math.max(0, Math.floor((Date.now() - created)/1000)); // seconds
	if(isNaN(diff)) return '0s';
	if(diff < 60) return `${diff}s`;
	if(diff < 3600){
		const m = Math.floor(diff/60);
		const s = diff % 60;
		return `${m}m ${s}s`;
	}
	if(diff < 86400){
		const h = Math.floor(diff/3600);
		const m = Math.floor((diff%3600)/60);
		return `${h}h ${m}m`;
	}
	const d = Math.floor(diff/86400);
	const h = Math.floor((diff%86400)/3600);
	return `${d}d ${h}h`;
}

// Update all visible ticket timers every second
function updateAllTimers(){
	document.querySelectorAll('.ticket').forEach(el=>{
		const created = el.dataset.created;
		const timerEl = el.querySelector('.ticket-timer');
		if(!created || !timerEl) return;
		timerEl.textContent = formatElapsed(created);
	});
}

// start interval
setInterval(updateAllTimers, 1000);

/*
=====================================================================
BARREL-ROLL EFFECT (disabled)

The barrel-roll implementation is included below but wrapped in this
comment block so it will NOT run. To enable the effect, delete the
opening "/*" and closing "" markers around this section.

Notes:
- The CSS for the animation lives in style.css (.barrel-roll).
- Enabling this will run the roll once per session on page load.
=====================================================================

// Barrel roll effect: play a short, non-repeating full-page spin on first visit in this session
function doBarrelRoll(duration = 1200){
	try{
		// apply class to root element so CSS handles the animation
		const root = document.documentElement;
		root.classList.add('barrel-roll');
		// disable pointer events during the roll to avoid accidental clicks
		root.style.pointerEvents = 'none';

		// listen for animationend to clean up (handles interrupts / pauses)
		const cleanup = () => {
			root.classList.remove('barrel-roll');
			root.style.pointerEvents = '';
			root.removeEventListener('animationend', cleanup);
			root.removeEventListener('animationcancel', cleanup);
		};
		root.addEventListener('animationend', cleanup);
		root.addEventListener('animationcancel', cleanup);
		// fallback cleanup in case events don't fire
		setTimeout(cleanup, duration + 200);
	}catch(e){ /* ignore in older browsers  }
}

// Play once per session to avoid annoying repeated spins
try{
	if(!sessionStorage.getItem('barrelRollSeen')){
		// run slightly after load so the header renders before the spin
		window.addEventListener('load', ()=> doBarrelRoll(1200));
		sessionStorage.setItem('barrelRollSeen','1');
	}
}catch(e){ /* sessionStorage may be unavailable  }

*/

function escapeHtml(str){ if(!str) return ''; return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Form handling
qs('#ticket-form').addEventListener('submit', async function(e){
	e.preventDefault();
	const data = {
		id: generateId(),
		name: qs('#name').value.trim(),
		department: qs('#department').value,
		priority: qs('#priority').value,
		topic: qs('#topic').value.trim(),
		title: qs('#title').value.trim(),
		description: qs('#description').value.trim(),
		createdAt: new Date().toISOString(),
		status: 'pending'
	};

	// Save first so the ticket is stored before the animation plays
	await saveTicket(data);
	this.reset();

	// ── Paper airplane animation sequence ──────────────────────────────────
	const formWrapper = qs('#form-wrapper');
	const planeStage  = qs('#plane-stage');
	const sentState   = qs('#sent-state');

	// Disable submit button so user can't double-submit during animation
	qs('#ticket-form button[type=submit]').disabled = true;

	// Step 1 — crumple the form (500ms)
	formWrapper.classList.add('crumpling');

	await new Promise(r => setTimeout(r, 420));

	// Step 2 — show crumpled ball where form was
	formWrapper.style.display = 'none';
	planeStage.classList.remove('hidden');
	planeStage.classList.add('show-ball');

	await new Promise(r => setTimeout(r, 350));

	// Step 3 — morph ball → airplane shape
	planeStage.classList.remove('show-ball');
	planeStage.classList.add('show-plane');

	await new Promise(r => setTimeout(r, 250));

	// Step 4 — fly off to the right (700ms)
	planeStage.classList.add('flying');

	await new Promise(r => setTimeout(r, 750));

	// Step 5 — plane gone; show empty sent state
	planeStage.classList.add('hidden');
	sentState.classList.remove('hidden');
	// ───────────────────────────────────────────────────────────────────────
});


// ── Donut chart renderer ──────────────────────────────────────────────────────
// Pure SVG — no libraries. Draws three arcs (sent / accepted / denied) as
// segments of a donut, animating via stroke-dasharray transitions.

const CIRCUMFERENCE = 2 * Math.PI * 80; // r=80 → ≈ 502.65

function setArc(el, dashLen, dashOffset) {
	if (!el) return;
	el.style.strokeDasharray  = `${dashLen.toFixed(2)} ${(CIRCUMFERENCE - dashLen).toFixed(2)}`;
	el.style.strokeDashoffset = `-${dashOffset.toFixed(2)}`;
}

async function renderDonutChart() {
	const tickets  = await loadTickets();
	const total    = tickets.length;
	const accepted = tickets.filter(tk => tk.status === 'accepted').length;
	const denied   = tickets.filter(tk => tk.status === 'denied').length;
	// "sent" = all tickets (total is the outer ring, accepted+denied are segments)
	const sent     = total;

	// Legend counts
	const lSent     = document.getElementById('legend-sent');
	const lAccepted = document.getElementById('legend-accepted');
	const lDenied   = document.getElementById('legend-denied');
	const centerNum   = document.getElementById('donut-center-num');
	const centerLabel = document.getElementById('donut-center-label');
	if (lSent)     lSent.textContent     = sent;
	if (lAccepted) lAccepted.textContent = accepted;
	if (lDenied)   lDenied.textContent   = denied;
	if (centerNum)   centerNum.textContent   = total;
	if (centerLabel) centerLabel.textContent = total === 1 ? 'ticket' : 'total';

	const arcSent     = document.getElementById('donut-sent');
	const arcAccepted = document.getElementById('donut-accepted');
	const arcDenied   = document.getElementById('donut-denied');

	if (total === 0) {
		// reset all arcs to empty
		[arcSent, arcAccepted, arcDenied].forEach(el => {
			if (el) el.style.strokeDasharray = `0 ${CIRCUMFERENCE}`;
		});
		return;
	}

	// Each segment length is proportional to its share of the total circumference.
	// Order on wheel: blue (sent/total) → green (accepted) → red (denied)
	// We draw "sent" as the full ring first (it IS the total), then overlay
	// accepted and denied as sub-segments.
	const lenSent     = CIRCUMFERENCE; // full ring = "all tickets sent"
	const lenAccepted = (accepted / total) * CIRCUMFERENCE;
	const lenDenied   = (denied   / total) * CIRCUMFERENCE;

	// Sent arc: full ring (background colour role, shows total)
	setArc(arcSent, lenSent, 0);

	// Accepted arc starts at 0° (top)
	setArc(arcAccepted, lenAccepted, 0);

	// Denied arc starts right after the accepted arc
	setArc(arcDenied, lenDenied, lenAccepted);
}
// ─────────────────────────────────────────────────────────────────────────────

// initial
showManager(false);
