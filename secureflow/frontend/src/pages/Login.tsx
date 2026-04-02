import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const s = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1117' } as const,
  card: { background: '#1a1d27', border: '1px solid #2d3148', borderRadius: 12, padding: 40, width: 380 } as const,
  title: { fontSize: 24, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 } as const,
  subtitle: { fontSize: 14, color: '#64748b', marginBottom: 32 } as const,
  label: { display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 } as const,
  input: { width: '100%', padding: '10px 14px', background: '#0f1117', border: '1px solid #2d3148', borderRadius: 8, color: '#e2e8f0', fontSize: 14, marginBottom: 20, outline: 'none' } as const,
  btn: { width: '100%', padding: '12px', background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' } as const,
  err: { color: '#f87171', fontSize: 13, marginBottom: 16 } as const,
  toggle: { marginTop: 20, textAlign: 'center' as const, fontSize: 13, color: '#64748b' },
  link: { color: '#6366f1', cursor: 'pointer', textDecoration: 'underline' } as const,
};

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const { data } = await api.post(endpoint, { email, password });
      if (mode === 'login') {
        login(data.token, data.user);
        navigate('/');
      } else {
        setMode('login');
        setError('Registered! Please log in.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Request failed');
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.title}>🔐 SecureFlow Vault</div>
        <div style={s.subtitle}>{mode === 'login' ? 'Sign in to your vault' : 'Create an account'}</div>
        {error && <div style={s.err}>{error}</div>}
        <form onSubmit={submit}>
          <label htmlFor="email" style={s.label}>Email</label>
          <input id="email" name="email" style={s.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          <label htmlFor="password" style={s.label}>Password</label>
          <input id="password" name="password" style={s.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          <button id="submit" style={s.btn} type="submit">{mode === 'login' ? 'Sign In' : 'Register'}</button>
        </form>
        <div style={s.toggle}>
          {mode === 'login' ? (
            <>No account? <span style={s.link} onClick={() => setMode('register')}>Register</span></>
          ) : (
            <>Have an account? <span style={s.link} onClick={() => setMode('login')}>Sign in</span></>
          )}
        </div>
      </div>
    </div>
  );
}
