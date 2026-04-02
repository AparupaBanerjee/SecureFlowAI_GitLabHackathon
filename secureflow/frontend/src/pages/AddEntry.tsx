import { useState, useEffect, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/client';

const s = {
  page: { minHeight: '100vh', background: '#0f1117', color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' } as const,
  card: { background: '#1a1d27', border: '1px solid #2d3148', borderRadius: 12, padding: 40, width: 460 } as const,
  title: { fontSize: 20, fontWeight: 700, marginBottom: 28 } as const,
  label: { display: 'block', fontSize: 13, color: '#94a3b8', marginBottom: 6 } as const,
  input: { width: '100%', padding: '10px 14px', background: '#0f1117', border: '1px solid #2d3148', borderRadius: 8, color: '#e2e8f0', fontSize: 14, marginBottom: 18, outline: 'none' } as const,
  textarea: { width: '100%', padding: '10px 14px', background: '#0f1117', border: '1px solid #2d3148', borderRadius: 8, color: '#e2e8f0', fontSize: 14, marginBottom: 18, outline: 'none', resize: 'vertical' as const, minHeight: 80 } as const,
  row: { display: 'flex', gap: 12 } as const,
  btn: (variant: 'primary' | 'ghost') => ({
    flex: 1, padding: '11px', borderRadius: 8, border: variant === 'ghost' ? '1px solid #2d3148' : 'none', cursor: 'pointer',
    background: variant === 'primary' ? '#6366f1' : 'transparent', color: variant === 'ghost' ? '#94a3b8' : '#fff', fontSize: 14, fontWeight: 600,
  }) as const,
  err: { color: '#f87171', fontSize: 13, marginBottom: 14 } as const,
};

export default function AddEntry() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', username: '', password: '', url: '', notes: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/entries`).then(({ data }) => {
      const entry = data.find((e: any) => String(e.id) === id);
      if (entry) setForm({ name: entry.name, username: entry.username || '', password: '', url: entry.url || '', notes: entry.notes || '' });
    });
  }, [id, isEdit]);

  const change = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isEdit) {
        await api.put(`/entries/${id}`, form);
      } else {
        await api.post('/entries', form);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save entry');
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.title}>{isEdit ? 'Edit Entry' : 'New Vault Entry'}</div>
        {error && <div style={s.err}>{error}</div>}
        <form onSubmit={submit}>
          <label style={s.label}>Name *</label>
          <input style={s.input} value={form.name} onChange={change('name')} placeholder="e.g. GitHub Work" required />

          <label style={s.label}>Username / Email</label>
          <input style={s.input} value={form.username} onChange={change('username')} placeholder="alice@example.com" />

          <label style={s.label}>Password *</label>
          <input style={s.input} type="password" value={form.password} onChange={change('password')} placeholder={isEdit ? '(leave blank to keep existing)' : 'Enter password'} required={!isEdit} />

          <label style={s.label}>URL</label>
          <input style={s.input} value={form.url} onChange={change('url')} placeholder="https://github.com" />

          <label style={s.label}>Notes</label>
          <textarea style={s.textarea} value={form.notes} onChange={change('notes')} placeholder="Any notes…" />

          <div style={s.row}>
            <button type="button" style={s.btn('ghost')} onClick={() => navigate('/')}>Cancel</button>
            <button type="submit" style={s.btn('primary')}>{isEdit ? 'Save Changes' : 'Add Entry'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
