// Simple single-file app logic
const qs = s => document.querySelector(s);
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

// Tickets storage
function loadTickets(){
	try{ return JSON.parse(localStorage.getItem('tickets')||'[]'); }catch(e){return []}
}
function saveTickets(t){ localStorage.setItem('tickets', JSON.stringify(t)); }

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

function renderTickets(){
	const tickets = loadTickets();
	ticketsContainer.innerHTML = '';
	if(tickets.length===0){ ticketsContainer.innerHTML = '<div>No tickets submitted yet.</div>'; return }
	tickets.slice().reverse().forEach((tk, idx)=>{
		const el = document.createElement('div'); el.className='ticket';
		const expired = isExpired(tk);
		// apply status classes (accepted/denied take precedence)
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

		// debug accept/deny buttons
		const controls = document.createElement('div');
		controls.style.marginTop = '10px';
		const acceptBtn = document.createElement('button');
		acceptBtn.className = 'debug-btn accept-btn';
		acceptBtn.textContent = tk.status === 'accepted' ? 'Unaccept' : 'Accept';
		acceptBtn.addEventListener('click', ()=>{
			const all = loadTickets();
			const item = all.find(x=>x.id === tk.id);
			if(!item) return;
			if(item.status === 'accepted') {
				// revert to no explicit status so expiration check applies
				delete item.status;
			} else {
				item.status = 'accepted';
			}
			saveTickets(all);
			renderTickets();
		});

		const denyBtn = document.createElement('button');
		denyBtn.className = 'debug-btn deny-btn';
		denyBtn.textContent = tk.status === 'denied' ? 'Undeny' : 'Deny';
		denyBtn.addEventListener('click', ()=>{
			const all = loadTickets();
			const item = all.find(x=>x.id === tk.id);
			if(!item) return;
			if(item.status === 'denied') {
				delete item.status;
			} else {
				item.status = 'denied';
			}
			saveTickets(all);
			renderTickets();
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

function escapeHtml(str){ if(!str) return ''; return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Form handling
qs('#ticket-form').addEventListener('submit', function(e){
	e.preventDefault();
	const data = {
		id: generateId(),
		name: qs('#name').value.trim(),
		department: qs('#department').value,
		priority: qs('#priority').value,
		topic: qs('#topic').value.trim(),
		title: qs('#title').value.trim(),
		description: qs('#description').value.trim(),
		createdAt: new Date().toISOString()
	};
	const tickets = loadTickets();
	tickets.push(data);
	saveTickets(tickets);
	// clear form
	this.reset();
	// show in manager -> My Ticket
	showManager(true);
});

// initial
showManager(false);
