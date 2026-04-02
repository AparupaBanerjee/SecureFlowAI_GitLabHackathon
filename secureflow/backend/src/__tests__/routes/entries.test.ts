import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../middleware/auth';

jest.mock('../../models/index', () => ({
  VaultEntry: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
}));

import { VaultEntry } from '../../models/index';
import entriesRouter from '../../routes/entries';

const app = express();
app.use(express.json());
app.use('/api/entries', entriesRouter);

// Tokens for two distinct users — real JWTs so the authenticate middleware works
const aliceToken = jwt.sign({ id: 1, email: 'alice@example.com', role: 'user' }, JWT_SECRET);
const bobToken   = jwt.sign({ id: 2, email: 'bob@example.com',   role: 'user' }, JWT_SECRET);

afterEach(() => jest.clearAllMocks());

// ── GET /api/entries ─────────────────────────────────────────────────────────

describe('GET /api/entries', () => {
  test('200 — returns entries belonging to the authenticated user', async () => {
    (VaultEntry.findAll as jest.Mock).mockResolvedValue([
      { id: 1, name: 'GitHub', username: 'alice@example.com' },
    ]);

    const res = await request(app)
      .get('/api/entries')
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toHaveProperty('name', 'GitHub');
  });

  test('401 — rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/entries');
    expect(res.status).toBe(401);
  });
});

// ── POST /api/entries ────────────────────────────────────────────────────────

describe('POST /api/entries', () => {
  test('201 — creates entry and returns id + name', async () => {
    (VaultEntry.create as jest.Mock).mockResolvedValue({ id: 5, name: 'GitLab' });

    const res = await request(app)
      .post('/api/entries')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ name: 'GitLab', password: 'supersecret' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 5, name: 'GitLab' });
  });

  test('400 — rejects missing name', async () => {
    const res = await request(app)
      .post('/api/entries')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ password: 'supersecret' });

    expect(res.status).toBe(400);
  });

  test('400 — rejects missing password', async () => {
    const res = await request(app)
      .post('/api/entries')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ name: 'GitLab' });

    expect(res.status).toBe(400);
  });
});

// ── PUT /api/entries/:id ─────────────────────────────────────────────────────

describe('PUT /api/entries/:id', () => {
  test('200 — updates own entry', async () => {
    const mockEntry = { id: 1, userId: 1, name: 'GitHub', update: jest.fn().mockResolvedValue(true) };
    (VaultEntry.findByPk as jest.Mock).mockResolvedValue(mockEntry);

    const res = await request(app)
      .put('/api/entries/1')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ name: 'GitHub (work)' });

    expect(res.status).toBe(200);
    expect(mockEntry.update).toHaveBeenCalledWith({ name: 'GitHub (work)' });
  });

  test('403 — cannot update another user\'s entry', async () => {
    // Alice owns this entry (userId:1), Bob (id:2) tries to edit
    (VaultEntry.findByPk as jest.Mock).mockResolvedValue({ id: 1, userId: 1, name: 'GitHub' });

    const res = await request(app)
      .put('/api/entries/1')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error', 'Forbidden');
  });

  test('404 — entry not found', async () => {
    (VaultEntry.findByPk as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .put('/api/entries/999')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ name: 'x' });

    expect(res.status).toBe(404);
  });
});

// ── DELETE /api/entries/:id ──────────────────────────────────────────────────

describe('DELETE /api/entries/:id', () => {
  test('200 — deletes own entry', async () => {
    const mockEntry = { id: 1, userId: 1, destroy: jest.fn().mockResolvedValue(true) };
    (VaultEntry.findByPk as jest.Mock).mockResolvedValue(mockEntry);

    const res = await request(app)
      .delete('/api/entries/1')
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(mockEntry.destroy).toHaveBeenCalled();
  });

  test('403 — cannot delete another user\'s entry', async () => {
    (VaultEntry.findByPk as jest.Mock).mockResolvedValue({ id: 1, userId: 1, destroy: jest.fn() });

    const res = await request(app)
      .delete('/api/entries/1')
      .set('Authorization', `Bearer ${bobToken}`);

    expect(res.status).toBe(403);
  });

  test('404 — entry not found', async () => {
    (VaultEntry.findByPk as jest.Mock).mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/entries/999')
      .set('Authorization', `Bearer ${aliceToken}`);

    expect(res.status).toBe(404);
  });
});
