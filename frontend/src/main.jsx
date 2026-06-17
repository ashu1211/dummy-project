import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RefreshCw, Server, Users } from 'lucide-react';
import './styles.css';

function App() {
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

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
