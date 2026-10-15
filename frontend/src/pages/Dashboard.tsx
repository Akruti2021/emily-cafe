import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api, getErrorMessage } from '../api/client';

export default function Dashboard() {
  const { user, logout, logoutAll, changePassword } = useAuth();
  const [apiResult, setApiResult] = useState('');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function callProtectedApi() {
    try {
      const { data } = await api.get('/auth/me');
      setApiResult(JSON.stringify(data, null, 2));
    } catch (err) {
      setApiResult(getErrorMessage(err));
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await changePassword(current, next);
      setMsg('Password changed. Other devices were logged out.');
      setCurrent('');
      setNext('');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div className="dash">
      <header>
        <h2>Dashboard</h2>
        <div className="row">
          <button className="secondary" onClick={logoutAll}>
            Log out all devices
          </button>
          <button onClick={logout}>Log out</button>
        </div>
      </header>

      <section className="card wide">
        <h3>Hello, {user?.name}</h3>
        <p className="muted">
          {user?.email} &middot; role: {user?.role}
        </p>
        <button className="secondary" onClick={callProtectedApi}>
          Call protected API
        </button>
        {apiResult && <pre>{apiResult}</pre>}
      </section>

      <section className="card wide">
        <h3>Change password</h3>
        <form onSubmit={onChangePassword}>
          <label>Current password</label>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          <label>New password</label>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required />
          {error && <div className="error">{error}</div>}
          {msg && <div className="success">{msg}</div>}
          <button>Update password</button>
        </form>
      </section>
    </div>
  );
}