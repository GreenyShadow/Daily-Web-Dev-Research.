// Internal Ticket Support — Auth logic
const qs = s => document.querySelector(s);
const qsa = s => Array.from(document.querySelectorAll(s));
const API_URL = 'http://localhost:3000';

const modeBtns = qsa('.mode-btn');
const loginForm = qs('#login-form');
const registerForm = qs('#register-form');
const loginError = qs('#login-error');
const registerNote = qs('#register-note');

let loginFailureCount = 0;
let registerFailureCount = 0;

// If already logged in this session, skip straight to the right app
const existingRole = sessionStorage.getItem('ticketRole');
if (existingRole === 'admin') location.href = '../Admin/index.html';
else if (existingRole === 'agent') location.href = '../Agent/index.html';
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
	if (mode === 'login') {
		loginFailureCount = 0;
		registerFailureCount = 0;
		loginError.classList.add('hidden');
		loginError.classList.remove('aggressive');
		registerNote.classList.remove('aggressive');
	}
}
modeBtns.forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));

// ── Login ────────────────────────────────────────────────────────────────────
function showLoginError(message, isAggressive = false){
	loginError.textContent = message;
	loginError.classList.remove('hidden');
	loginError.classList.toggle('aggressive', isAggressive);
	const card = qs('.form-card');
	card.classList.remove('shake');
	requestAnimationFrame(() => card.classList.add('shake'));
}

function showRegisterNote(message, isAggressive = false){
	registerNote.textContent = message;
	registerNote.classList.remove('hidden');
	registerNote.classList.toggle('aggressive', isAggressive);
	const card = qs('.form-card');
	card.classList.remove('shake');
	requestAnimationFrame(() => card.classList.add('shake'));
}

function getLoginFailureMessage(){
	const messages = [
		'Please enter a valid username and password.',
		'That still is not correct. Try again carefully.',
		'Stop spamming the button and enter your credentials properly.',
		'This is getting ridiculous. Enter the correct details or stop clicking.',
		'You are making this harder than it needs to be. Use the proper username and password.',
		'Please stop pressing Log in like that and enter the right credentials already.'
	];
	return messages[Math.min(loginFailureCount - 1, messages.length - 1)];
}

function getRegisterFailureMessage(){
	const messages = [
		'Registration is unavailable in this demo. Please use the demo login details instead.',
		'You are still trying to register here. Please log in with one of the demo accounts.',
		'Stop pressing Register and use the login form instead.',
		'This is not the right path. Please go back to the Log in form and use the demo account.',
		'Enough already. Return to Log in before this gets even more annoying.',
		'Please stop trying to register here and use the Log in option instead.'
	];
	return messages[Math.min(registerFailureCount - 1, messages.length - 1)];
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

const loginInputs = qsa('#login-username, #login-password');
loginInputs.forEach(input => {
	input.addEventListener('input', () => {
		if (loginFailureCount > 0) {
			loginFailureCount = 0;
			loginError.classList.add('hidden');
			loginError.classList.remove('aggressive');
		}
	});
});

loginForm.addEventListener('submit', async (e) => {
	e.preventDefault();
	loginError.classList.add('hidden');
	loginError.classList.remove('aggressive');

	const username = qs('#login-username').value.trim();
	const password = qs('#login-password').value;

	if (!username || !password) {
		loginFailureCount += 1;
		showLoginError(getLoginFailureMessage(), loginFailureCount >= 3);
		return;
	}

	setLoginLoading(true);
	try {
		const { token, role } = await attemptLogin(username, password);
		loginFailureCount = 0;
		sessionStorage.setItem('ticketToken', token);
		sessionStorage.setItem('ticketRole', role);
		sessionStorage.setItem('ticketUser', username);
		const dest = role === 'admin' ? '../Admin/index.html' : role === 'agent' ? '../Agent/index.html' : '../Member/index.html';
		location.href = dest;
	} catch (err) {
		loginFailureCount += 1;
		showLoginError(getLoginFailureMessage(), loginFailureCount >= 3);
	} finally {
		setLoginLoading(false);
	}
});

// ── Register (NBA — no function in this demo) ───────────────────────────────
registerForm.addEventListener('submit', (e) => {
	e.preventDefault();
	registerFailureCount += 1;
	const isFinalStage = registerFailureCount >= 3;
	showRegisterNote(getRegisterFailureMessage(), isFinalStage);

	if (registerFailureCount > 6) {
		window.setTimeout(() => {
			setMode('login');
			qs('#login-username').focus();
		}, 900);
	}
});
