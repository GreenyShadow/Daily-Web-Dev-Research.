// Internal Ticket Support — Auth logic
const qs = s => document.querySelector(s);
const qsa = s => Array.from(document.querySelectorAll(s));
const API_URL = 'http://localhost:3000';

const modeBtns = qsa('.mode-btn');
const loginForm = qs('#login-form');
const registerForm = qs('#register-form');
const loginError = qs('#login-error');

// If already logged in this session, skip straight to the right app
const existingRole = sessionStorage.getItem('ticketRole');
if (existingRole === 'admin') location.href = '../Admin/index.html';
else if (existingRole === 'member') location.href = '../Member/index.html';

// ── Mode toggle (Log in / Register) ─────────────────────────────────────────
function setMode(mode){
	modeBtns.forEach(b => {
		const active = b.dataset.mode === mode;
		b.classList.toggle('active', active);
		b.setAttribute('aria-selected', active ? 'true' : 'false');
	});
	loginForm.classList.toggle('hidden', mode !== 'login');
	registerForm.classList.toggle('hidden', mode !== 'register');
}
modeBtns.forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));

// ── Login ────────────────────────────────────────────────────────────────────
function showLoginError(message){
	loginError.textContent = message;
	loginError.classList.remove('hidden');
	const card = qs('.form-card');
	card.classList.remove('shake');
	// restart animation
	requestAnimationFrame(() => card.classList.add('shake'));
}

function setLoginLoading(isLoading){
	const btn = loginForm.querySelector('.submit-btn');
	btn.disabled = isLoading;
	btn.querySelector('.btn-label').classList.toggle('hidden', isLoading);
	btn.querySelector('.btn-spinner').classList.toggle('hidden', !isLoading);
}

async function attemptLogin(username, password){
	const res = await fetch(`${API_URL}/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password })
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error || 'Invalid username or password');
	return data; // { token, username, role }
}

loginForm.addEventListener('submit', async (e) => {
	e.preventDefault();
	loginError.classList.add('hidden');

	const username = qs('#login-username').value.trim();
	const password = qs('#login-password').value;

	setLoginLoading(true);
	try {
		const { token, role } = await attemptLogin(username, password);
		sessionStorage.setItem('ticketToken', token);
		sessionStorage.setItem('ticketRole', role);
		sessionStorage.setItem('ticketUser', username);
		location.href = role === 'admin' ? '../Admin/index.html' : '../Member/index.html';
	} catch (err) {
		showLoginError(err.message || 'Could not reach the server. Please try again.');
	} finally {
		setLoginLoading(false);
	}
});

// ── Register (NBA — no function in this demo) ───────────────────────────────
registerForm.addEventListener('submit', (e) => {
	e.preventDefault();
	const note = qs('#register-note');
	note.textContent = 'Registration isn\u2019t available in this demo yet — please log in with one of the demo accounts instead.';
	note.classList.remove('hidden');
	const card = qs('.form-card');
	card.classList.remove('shake');
	requestAnimationFrame(() => card.classList.add('shake'));
});
