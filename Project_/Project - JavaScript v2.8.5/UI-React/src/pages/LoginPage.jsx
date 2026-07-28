import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Banner from '../components/Banner.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-[380px]">
        <CardContent className="pt-8">
          <div className="mb-4 h-9 w-9 rounded-lg bg-primary" />
          <h1 className="font-display text-2xl font-bold">Deskline</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Internal Support Request Management System</p>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <Banner kind="error">{error}</Banner>

            <Button type="submit" disabled={loading} className="justify-center">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-6 border-t border-border pt-4">
            <span className="text-xs text-muted-foreground">Demo accounts (password: Demo)</span>
            <div className="mt-2 flex gap-2">
              {DEMO_ACCOUNTS.map((a) => (
                <Button key={a.username} type="button" variant="outline" size="sm" onClick={() => fillDemo(a.username)}>
                  {a.username}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
