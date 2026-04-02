import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Login from '../../pages/Login';
import { AuthProvider } from '../../context/AuthContext';

// Mock the axios API client
vi.mock('../../api/client', () => ({
  default: { post: vi.fn() },
}));

// Mock useNavigate so we can assert on navigation calls
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import api from '../../api/client';

// Returns the full render result so tests can use `container` for queries.
// Login.tsx labels lack htmlFor, so getByLabelText won't work — we target
// the inputs directly via their id attributes (#email, #password).
function renderLogin() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function emailInput(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('#email')!;
}
function passwordInput(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('#password')!;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Login page', () => {
  test('renders email, password fields and Sign In button', () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  test('successful login navigates to dashboard', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        token: 'jwt-tok',
        user: { id: 1, email: 'alice@example.com', role: 'user' },
      },
    });

    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'Alice1234!');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'));
    expect(localStorage.getItem('token')).toBe('jwt-tok');
  });

  test('failed login shows error message', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockRejectedValue({
      response: { data: { error: 'Invalid credentials' } },
    });

    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument(),
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('toggling to register mode changes button label', async () => {
    renderLogin();
    await userEvent.click(screen.getByText(/register/i));
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
  });
});
