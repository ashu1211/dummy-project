import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Plus, RefreshCw, Server, Users } from 'lucide-react';
import './styles.css';

function App() {
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', role: '' });
  const [formStatus, setFormStatus] = useState('idle');
  const [formError, setFormError] = useState('');

  async function loadUsers() {
    setStatus('loading');
    setError('');

    try {
      const response = await fetch('/api/users');

      if (!response.ok) {
        throw new Error(`Backend returned HTTP ${response.status}`);
      }

      const data = await response.json();
      setUsers(data);
      setStatus('ready');
    } catch (loadError) {
      setError(loadError.message);
      setStatus('error');
    }
  }

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function addUser(event) {
    event.preventDefault();
    setFormStatus('saving');
    setFormError('');

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Backend returned HTTP ${response.status}`);
      }

      setUsers((current) => [...current, data]);
      setForm({ name: '', email: '', role: '' });
      setFormStatus('idle');
    } catch (saveError) {
      setFormError(saveError.message);
      setFormStatus('error');
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <main className="shell">
      <section className="topbar" aria-label="Application status">
        <div>
          <p className="eyebrow">Minikube full-stack demo</p>
          <h1>Users from MySQL</h1>
        </div>
        <div className={`status ${status}`}>
          <Server size={18} aria-hidden="true" />
          <span>{status === 'ready' ? 'Connected' : status}</span>
        </div>
      </section>

      <section className="toolbar" aria-label="Users toolbar">
        <div className="count">
          <Users size={20} aria-hidden="true" />
          <span>{users.length} users</span>
        </div>
        <button onClick={loadUsers} type="button" disabled={status === 'loading'}>
          <RefreshCw size={18} aria-hidden="true" />
          <span>Refresh</span>
        </button>
      </section>

      <section className="panel" aria-label="Add user">
        <div className="panel-heading">
          <h2>Add User</h2>
          <span>Save a new user to MySQL</span>
        </div>
        <form className="user-form" onSubmit={addUser}>
          <label>
            <span>Name</span>
            <input
              name="name"
              onChange={updateForm}
              placeholder="Enter name"
              required
              type="text"
              value={form.name}
            />
          </label>
          <label>
            <span>Email</span>
            <input
              name="email"
              onChange={updateForm}
              placeholder="name@example.com"
              required
              type="email"
              value={form.email}
            />
          </label>
          <label>
            <span>Role</span>
            <input
              name="role"
              onChange={updateForm}
              placeholder="Engineer"
              required
              type="text"
              value={form.role}
            />
          </label>
          <button type="submit" disabled={formStatus === 'saving'}>
            <Plus size={18} aria-hidden="true" />
            <span>{formStatus === 'saving' ? 'Saving' : 'Add'}</span>
          </button>
        </form>
        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}
      </section>

      {status === 'error' ? (
        <section className="notice" role="alert">
          <strong>Could not load users.</strong>
          <span>{error}</span>
        </section>
      ) : (
        <section className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{new Date(user.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
