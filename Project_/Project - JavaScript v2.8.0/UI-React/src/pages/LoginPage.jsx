import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Banner from '../components/Banner.jsx';
import './LoginPage.css';

const DEMO_ACCOUNTS = [
  { username: 'Admin', role: 'admin' },
  { username: 'Agent', role: 'agent' },
  { username: 'Member', role: 'member' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const session = await login(username.trim(), password);
      navigate(`/${session.role}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(name) {
    setUsername(name);
    setPassword('Demo');
    setError('');
  }

  return (
    <div className="login-page">
      <div className="login-card card">
        <div className="login-mark" />
        <h1 className="login-title">Deskline</h1>
        <p className="login-sub">Internal Support Request Management System</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <Banner kind="error">{error}</Banner>}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ justifyContent: 'center' }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="login-demo">
          <span>Demo accounts (password: Demo)</span>
          <div className="login-demo-row">
            {DEMO_ACCOUNTS.map((a) => (
              <button key={a.username} type="button" className="btn btn-ghost btn-sm" onClick={() => fillDemo(a.username)}>
                {a.username}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
