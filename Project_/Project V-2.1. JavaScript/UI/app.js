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
const ticketsContainer = qs('#tickets-container');
const sideB = qs('#side-b');
const sideC = qs('#side-c');

function showManager(showTickets=false){
	managerView.classList.remove('hidden');
	submitterView.classList.add('hidden');
	if(showTickets){
		dashboardText.classList.add('hidden');
		myTicketsEl.classList.remove('hidden');
		renderTickets();
	} else {
		dashboardText.classList.remove('hidden');
		myTicketsEl.classList.add('hidden');
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

async function patchTicketApi(id, updates){
	const res = await fetch(`${API_URL}/tickets/${encodeURIComponent(id)}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(updates)
	});
	if(!res.ok) throw new Error('API update failed');
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

async function updateTicketStatus(id, status){
	try {
		return await patchTicketApi(id, status ? { status } : { status: '' });
	} catch (err) {
		formatApiError(err);
		const tickets = loadTicketsLocal();
		const ticket = tickets.find(item => item.id === id);
		if (!ticket) throw err;
		if (status) ticket.status = status;
		else delete ticket.status;
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

		el.innerHTML = `<strong class="ticket-title">${escapeHtml(tk.title)}</strong>
		<div class="ticket-priority">${escapeHtml(tk.priority)}</div>
		<div class="ticket-id">ID: ${escapeHtml(tk.id || '')}</div>
		<div class="ticket-timer">${escapeHtml(formatElapsed(tk.createdAt))}</div>
		<div><em>${escapeHtml(tk.topic||'')}</em></div>
		<div class="ticket-desc">${escapeHtml(tk.description||'')}</div>
		<div class="ticket-meta">By ${escapeHtml(tk.name)} — ${escapeHtml(tk.department)}</div>`;
		el.dataset.created = tk.createdAt;
		el.dataset.tid = tk.id || '';

		const controls = document.createElement('div');
		controls.style.marginTop = '10px';

		const acceptBtn = document.createElement('button');
		acceptBtn.className = 'debug-btn accept-btn';
		acceptBtn.textContent = tk.status === 'accepted' ? 'Unaccept' : 'Accept';
		acceptBtn.addEventListener('click', async ()=>{
			const item = await updateTicketStatus(tk.id, tk.status === 'accepted' ? '' : 'accepted');
			if(item) renderTickets();
		});

		const denyBtn = document.createElement('button');
		denyBtn.className = 'debug-btn deny-btn';
		denyBtn.textContent = tk.status === 'denied' ? 'Undeny' : 'Deny';
		denyBtn.addEventListener('click', async ()=>{
			const item = await updateTicketStatus(tk.id, tk.status === 'denied' ? '' : 'denied');
			if(item) renderTickets();
		});

		controls.appendChild(acceptBtn);
		controls.appendChild(denyBtn);
		el.appendChild(controls);
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

	await saveTicket(data);
	this.reset();
	showManager(true);
});

// initial
showManager(false);
