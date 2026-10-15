import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../auth/AuthContext';
import { getErrorMessage } from '../api/client';

export default function Signup() {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signup(name, email, password);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="It only takes a minute">
      <form onSubmit={onSubmit}>
        <label>Full name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <small className="muted">At least 8 characters, with a letter and a number.</small>
        {error && <div className="error">{error}</div>}
        <button disabled={busy}>{busy ? 'Creating...' : 'Sign up'}</button>
      </form>
      <p className="links">
        <span>
          Already have an account? <Link to="/login">Log in</Link>
        </span>
      </p>
    </AuthLayout>
  );
}