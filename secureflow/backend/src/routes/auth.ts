import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../models/index';
import { JWT_SECRET } from '../middleware/auth';

const router = Router();

// VULNERABILITY: No rate limiting on /login — intentional for DAST demo.
// Express-rate-limit is NOT applied here so DAST can detect brute-force exposure.

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    // VULNERABILITY: bcrypt work factor of 5 (recommended minimum is 12).
    // Intentional for SAST demo — CWE-916 / insufficient password hashing.
    const hashed = await bcrypt.hash(password, 5);
    const user = await User.create({ email, password: hashed, role: 'user' });

    res.status(201).json({ id: user.id, email: user.email });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
// VULNERABILITY: No rate limiting — intentional for DAST demo.
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // VULNERABILITY: JWT signed with hardcoded secret (imported from middleware/auth.ts).
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch {
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
