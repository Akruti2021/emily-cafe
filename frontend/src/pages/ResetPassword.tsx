import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { api, getErrorMessage } from '../api/client';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/reset-password', { token, newPassword });
      setMessage(data.message);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Invalid link">
        <p>This reset link is missing its token.</p>
        <Link to="/forgot-password">Request a new link</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set a new password">
      {message ? (
        <>
          <div className="success">{message}</div>
          <p className="links">
            <Link to="/login">Go to login</Link>
          </p>
        </>
      ) : (
        <form onSubmit={onSubmit}>
          <label>New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoFocus
          />
          <small className="muted">At least 8 characters, with a letter and a number.</small>
          {error && <div className="error">{error}</div>}
          <button disabled={busy}>{busy ? 'Saving...' : 'Update password'}</button>
        </form>
      )}
    </AuthLayout>
  );
}