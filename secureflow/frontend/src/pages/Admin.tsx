import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

interface AuditLog {
  id: number;
  userId: number;
  entryId: number | null;
  action: string;
  ipAddress: string;
  createdAt: string;
}

interface UserRow {
  id: number;
  email: string;
  role: string;
  createdAt: string;
}

const s = {
  page: { minHeight: '100vh', background: '#0f1117', color: '#e2e8f0' } as const,
  nav: { background: '#1a1d27', borderBottom: '1px solid #2d3148', padding: '14px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as const,
  logo: { fontSize: 18, fontWeight: 700 } as const,
  main: { maxWidth: 1000, margin: '0 auto', padding: '32px 16px' } as const,
  h2: { fontSize: 18, fontWeight: 700, marginBottom: 16, marginTop: 32, color: '#a5f3fc' } as const,
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { padding: '10px 14px', background: '#1a1d27', borderBottom: '1px solid #2d3148', textAlign: 'left' as const, fontSize: 12, color: '#64748b', fontWeight: 600 },
  td: { padding: '10px 14px', borderBottom: '1px solid #1a1d27', fontSize: 13, color: '#cbd5e1' } as const,
  badge: (role: string) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
    background: role === 'admin' ? '#7c3aed' : '#1e293b', color: role === 'admin' ? '#e9d5ff' : '#94a3b8',
  }) as const,
  btn: { padding: '8px 16px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 13, color: '#94a3b8' } as const,
  warn: { background: '#7c1d1d', border: '1px solid #991b1b', borderRadius: 8, padding: '12px 16px', marginBottom: 24, fontSize: 13, color: '#fca5a5' } as const,
};

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);

  // NOTE: This page is accessible to ALL authenticated users due to the broken
  // access control on the backend — the role check is commented out (TODO).
  useEffect(() => {
    api.get('/admin/audit-logs').then(({ data }) => setLogs(data)).catch(() => {});
    api.get('/admin/users').then(({ data }) => setUsers(data)).catch(() => {});
  }, []);

  return (
    <div style={s.page}>
      <nav style={s.nav}>
        <span style={s.logo}>🔐 SecureFlow Vault — Admin</span>
        <button style={s.btn} onClick={() => navigate('/')}>← Back to Vault</button>
      </nav>

      <div style={s.main}>
        {user?.role !== 'admin' && (
          <div style={s.warn}>
            ⚠️ <strong>Broken Access Control:</strong> You are not an admin but can still view this page.
            The backend role check is commented out. This is an intentional vulnerability for demo purposes.
          </div>
        )}

        <h2 style={s.h2}>Users ({users.length})</h2>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>ID</th>
              <th style={s.th}>Email</th>
              <th style={s.th}>Role</th>
              <th style={s.th}>Registered</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={s.td}>{u.id}</td>
                <td style={s.td}>{u.email}</td>
                <td style={s.td}><span style={s.badge(u.role)}>{u.role}</span></td>
                <td style={s.td}>{new Date(u.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 style={s.h2}>Audit Logs ({logs.length})</h2>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>ID</th>
              <th style={s.th}>User ID</th>
              <th style={s.th}>Action</th>
              <th style={s.th}>Entry ID</th>
              <th style={s.th}>IP Address</th>
              <th style={s.th}>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td style={s.td}>{log.id}</td>
                <td style={s.td}>{log.userId}</td>
                <td style={{ ...s.td, color: '#fbbf24', fontWeight: 600 }}>{log.action}</td>
                <td style={s.td}>{log.entryId ?? '—'}</td>
                <td style={s.td}>{log.ipAddress}</td>
                <td style={s.td}>{new Date(log.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
