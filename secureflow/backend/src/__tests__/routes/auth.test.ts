import express from 'express';
import request from 'supertest';

// Mocks must be declared before any imports that pull in the real modules
jest.mock('../../models/index', () => ({
  User: { findOne: jest.fn(), create: jest.fn() },
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$hashed'),
  compare: jest.fn(),
}));

import { User } from '../../models/index';
import bcrypt from 'bcrypt';
import authRouter from '../../routes/auth';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

afterEach(() => jest.clearAllMocks());

// ── Register ────────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  test('201 — creates user and returns id + email', async () => {
    (User.findOne as jest.Mock).mockResolvedValue(null);
    (User.create as jest.Mock).mockResolvedValue({ id: 1, email: 'alice@example.com' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'alice@example.com', password: 'Alice1234!' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 1, email: 'alice@example.com' });
  });

  test('409 — rejects duplicate email', async () => {
    (User.findOne as jest.Mock).mockResolvedValue({ id: 1, email: 'alice@example.com' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'alice@example.com', password: 'Alice1234!' });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error', 'Email already registered');
  });

  test('400 — rejects missing password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'alice@example.com' });

    expect(res.status).toBe(400);
  });

  test('400 — rejects missing email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ password: 'Alice1234!' });

    expect(res.status).toBe(400);
  });
});

// ── Login ───────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  const dbUser = { id: 1, email: 'alice@example.com', role: 'user', password: '$hashed' };

  test('200 — returns JWT and user on valid credentials', async () => {
    (User.findOne as jest.Mock).mockResolvedValue(dbUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'Alice1234!' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({ email: 'alice@example.com', role: 'user' });
  });

  test('401 — rejects unknown user', async () => {
    (User.findOne as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'pass' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid credentials');
  });

  test('401 — rejects wrong password', async () => {
    (User.findOne as jest.Mock).mockResolvedValue(dbUser);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'wrongpass' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid credentials');
  });

  test('400 — rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com' });

    expect(res.status).toBe(400);
  });
});
