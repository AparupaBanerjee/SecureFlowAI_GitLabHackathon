import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

interface Entry {
  id: number;
  name: string;
  username: string;
  url: string;
  notes: string;
  createdAt: string;
}

const s = {
  page: { minHeight: '100vh', background: '#0f1117', color: '#e2e8f0' } as const,
  nav: { background: '#1a1d27', borderBottom: '1px solid #2d3148', padding: '14px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as const,
  logo: { fontSize: 18, fontWeight: 700 } as const,
  navRight: { display: 'flex', gap: 12, alignItems: 'center' } as const,
  btn: (variant: 'primary' | 'ghost' | 'danger') => ({
    padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    background: variant === 'primary' ? '#6366f1' : variant === 'danger' ? '#ef4444' : 'transparent',
    color: variant === 'ghost' ? '#94a3b8' : '#fff',
  }) as const,
  main: { maxWidth: 900, margin: '0 auto', padding: '32px 16px' } as const,
  searchBar: { display: 'flex', gap: 8, marginBottom: 24 } as const,
  input: { flex: 1, padding: '10px 14px', background: '#1a1d27', border: '1px solid #2d3148', borderRadius: 8, color: '#e2e8f0', fontSize: 14, outline: 'none' } as const,
  card: { background: '#1a1d27', border: '1px solid #2d3148', borderRadius: 10, padding: '18px 22px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } as const,
  entryName: { fontWeight: 600, fontSize: 15, marginBottom: 4 } as const,
  entryMeta: { color: '#64748b', fontSize: 13 } as const,
  actions: { display: 'flex', gap: 8, flexShrink: 0 } as const,
  reveal: { padding: '6px 12px', background: '#1e293b', border: '1px solid #2d3148', borderRadius: 6, color: '#e2e8f0', fontSize: 13, cursor: 'pointer' } as const,
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [search, setSearch] = useState('');

  const fetchEntries = async (q?: string) => {
    try {
      if (q && q.trim()) {
        const { data } = await api.get(`/search?q=${encodeURIComponent(q)}`);
        setEntries(data);
      } else {
        const { data } = await api.get('/entries');
        setEntries(data);
      }
    } catch {
      setEntries([]);
    }
  };

  useEffect(() => { fetchEntries(); }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    fetchEntries(e.target.value);
  };

  const deleteEntry = async (id: number) => {
    if (!confirm('Delete this entry?')) return;
    await api.delete(`/entries/${id}`);
    fetchEntries(search);
  };

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <span style={s.logo}>🔐 SecureFlow Vault</span>
        <div style={s.navRight}>
          <span style={{ fontSize: 13, color: '#64748b' }}>{user?.email}</span>
          <button style={s.btn('ghost')} onClick={() => { logout(); navigate('/login'); }}>Logout</button>
        </div>
      </nav>

      <div style={s.main}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>My Vault ({entries.length})</h1>
          <button style={s.btn('primary')} onClick={() => navigate('/entries/new')}>+ Add Entry</button>
        </div>

        <div style={s.searchBar}>
          <input
            style={s.input}
            placeholder="Search entries…"
            value={search}
            onChange={handleSearch}
          />
        </div>

        {entries.length === 0 && (
          <p style={{ color: '#64748b', textAlign: 'center', marginTop: 60 }}>No entries yet. Add your first password above.</p>
        )}

        {entries.map((entry) => (
          <div key={entry.id} style={s.card}>
            <div style={{ flex: 1 }}>
              <div style={s.entryName}>{entry.name}</div>
              <div style={s.entryMeta}>
                {entry.username && <span>{entry.username}</span>}
                {entry.url && <span> · <a href={entry.url} target="_blank" rel="noreferrer" style={{ color: '#6366f1' }}>{entry.url}</a></span>}
              </div>
              {entry.notes && <div style={{ ...s.entryMeta, marginTop: 4 }}>{entry.notes}</div>}
            </div>
            <div style={s.actions}>
              <button style={s.reveal} onClick={() => navigate(`/entries/${entry.id}/edit`)}>Edit</button>
              <button style={{ ...s.reveal, color: '#f87171' }} onClick={() => deleteEntry(entry.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
