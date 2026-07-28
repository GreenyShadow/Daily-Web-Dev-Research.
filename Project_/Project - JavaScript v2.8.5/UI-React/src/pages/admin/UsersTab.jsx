import { useState } from 'react';
import { PageHeader } from '../../components/PageHeader.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const ROLES = ['member', 'agent', 'admin'];
const emptyForm = { username: '', password: '', role: 'member' };

export default function UsersTab({ users, api, onChanged, setError }) {
  const { session } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editRole, setEditRole] = useState('');
  const [editPassword, setEditPassword] = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await api.createUser(form);
      setForm(emptyForm);
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  function openEdit(u) {
    setEditingUser(u.username);
    setEditRole(u.role);
    setEditPassword('');
  }

  async function saveEdit() {
    try {
      const updates = {};
      if (editRole) updates.role = editRole;
      if (editPassword) updates.password = editPassword;
      await api.updateUser(editingUser, updates);
      setEditingUser(null);
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(username) {
    if (!confirm(`Remove the account "${username}"? This cannot be undone.`)) return;
    try {
      await api.deleteUser(username);
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <PageHeader title="User accounts" subtitle="Provision, edit, or remove Member / Agent / Admin accounts." />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'flex-start' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--ink-soft)', fontSize: 11.5, textTransform: 'uppercase', background: 'var(--paper)' }}>
                <th style={{ padding: '10px 16px' }}>Username</th>
                <th style={{ padding: '10px 16px' }}>Role</th>
                <th style={{ padding: '10px 16px' }}></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.username} style={{ borderTop: '1px solid var(--line-soft)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600 }}>
                    {u.username} {u.username === session.username && <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>(you)</span>}
                  </td>
                  <td style={{ padding: '10px 16px', textTransform: 'capitalize' }}>{u.role}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)} style={{ marginRight: 6 }}>Edit</button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => remove(u.username)}
                      disabled={u.username === session.username}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={handleCreate}>
          <h3 style={{ fontSize: 14 }}>Add account</h3>
          <div className="field">
            <label>Username</label>
            <input required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
          <div className="field">
            <label>Password</label>
            <input required type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="field">
            <label>Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Create account'}
          </button>
        </form>
      </div>

      {editingUser && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setEditingUser(null)}>
          <div className="modal-panel" style={{ maxWidth: 380 }}>
            <div className="modal-head">
              <h3>Edit {editingUser}</h3>
              <button className="modal-close" onClick={() => setEditingUser(null)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="field">
                <label>Role</label>
                <select value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Reset password (optional)</label>
                <input value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Leave blank to keep current password" />
              </div>
              <p style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Changing role or password logs this user out of any existing session.</p>
              <button className="btn btn-primary" onClick={saveEdit}>Save changes</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
