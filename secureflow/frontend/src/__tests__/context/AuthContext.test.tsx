import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../context/AuthContext';

// ── Small helper components that expose internal auth state ──────────────────

function AuthDisplay() {
  const { token, user } = useAuth();
  return (
    <>
      <span data-testid="token">{token ?? 'none'}</span>
      <span data-testid="email">{user?.email ?? 'none'}</span>
    </>
  );
}

function LoginBtn() {
  const { login } = useAuth();
  return (
    <button
      onClick={() => login('tok-123', { id: 1, email: 'alice@example.com', role: 'user' })}
    >
      login
    </button>
  );
}

function LogoutBtn() {
  const { logout } = useAuth();
  return <button onClick={logout}>logout</button>;
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => localStorage.clear());

describe('AuthContext', () => {
  test('starts unauthenticated when localStorage is empty', () => {
    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>,
    );
    expect(screen.getByTestId('token').textContent).toBe('none');
    expect(screen.getByTestId('email').textContent).toBe('none');
  });

  test('restores session from localStorage on mount', () => {
    localStorage.setItem('token', 'saved-tok');
    localStorage.setItem(
      'user',
      JSON.stringify({ id: 1, email: 'alice@example.com', role: 'user' }),
    );

    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>,
    );

    expect(screen.getByTestId('token').textContent).toBe('saved-tok');
    expect(screen.getByTestId('email').textContent).toBe('alice@example.com');
  });

  test('login() updates state and persists to localStorage', () => {
    render(
      <AuthProvider>
        <AuthDisplay />
        <LoginBtn />
      </AuthProvider>,
    );

    act(() => screen.getByText('login').click());

    expect(screen.getByTestId('token').textContent).toBe('tok-123');
    expect(screen.getByTestId('email').textContent).toBe('alice@example.com');
    expect(localStorage.getItem('token')).toBe('tok-123');
  });

  test('logout() clears state and localStorage', () => {
    localStorage.setItem('token', 'tok-123');
    localStorage.setItem(
      'user',
      JSON.stringify({ id: 1, email: 'alice@example.com', role: 'user' }),
    );

    render(
      <AuthProvider>
        <AuthDisplay />
        <LogoutBtn />
      </AuthProvider>,
    );

    act(() => screen.getByText('logout').click());

    expect(screen.getByTestId('token').textContent).toBe('none');
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});
