import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, JWT_SECRET, AuthRequest } from '../../middleware/auth';

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('authenticate middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = jest.fn();
  });

  test('rejects request with no Authorization header', () => {
    const req = { headers: {} } as AuthRequest;
    const res = makeRes();
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects non-Bearer Authorization scheme', () => {
    const req = { headers: { authorization: 'Basic dXNlcjpwYXNz' } } as AuthRequest;
    const res = makeRes();
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('accepts valid JWT and attaches decoded user to request', () => {
    const payload = { id: 1, email: 'alice@example.com', role: 'user' };
    const token = jwt.sign(payload, JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthRequest;
    const res = makeRes();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject(payload);
  });

  test('rejects a tampered / invalid JWT', () => {
    const req = { headers: { authorization: 'Bearer not.a.valid.token' } } as AuthRequest;
    const res = makeRes();
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects an expired JWT', () => {
    const token = jwt.sign(
      { id: 1, email: 'alice@example.com', role: 'user' },
      JWT_SECRET,
      { expiresIn: -1 }, // already expired
    );
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthRequest;
    const res = makeRes();
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
