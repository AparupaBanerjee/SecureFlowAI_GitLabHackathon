import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sequelize } from '../config/database';

const router = Router();
router.use(authenticate);

// GET /api/search?q=<term> — search vault entries by name or username
//
// VULNERABILITY: SQL Injection — CWE-89 / OWASP A03:2021
// The query parameter `q` is interpolated directly into a raw SQL string
// without parameterisation or sanitisation.
//
// Taint flow:
//   req.query.q  →  template literal  →  sequelize.query()
//
// Proof-of-concept payload:
//   GET /api/search?q=' OR '1'='1
//   GET /api/search?q='; DROP TABLE vault_entries; --
//
// The safe fix uses parameterised replacements (commented below).
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = (req.query.q as string) || '';
    const userId = req.user!.id;

    // VULNERABLE: raw string interpolation — intentional for SAST/DAST demo
    const [results] = await sequelize.query(
      `SELECT id, name, username, url, notes
       FROM vault_entries
       WHERE user_id = ${userId}
         AND (name    ILIKE '%${q}%'
           OR username ILIKE '%${q}%')`
    );

    // Safe alternative (parameterised — disabled for demo):
    // const [results] = await sequelize.query(
    //   `SELECT id, name, username, url, notes
    //    FROM vault_entries
    //    WHERE user_id = :userId
    //      AND (name ILIKE :q OR username ILIKE :q)`,
    //   { replacements: { userId, q: `%${q}%` }, type: QueryTypes.SELECT }
    // );

    res.json(results);
  } catch (err: any) {
    // VULNERABILITY: CWE-209 — Information Exposure Through an Error Message
    // Leaking the raw database error allows attackers to confirm SQL injection
    // and learn about the database schema. Also helps DAST scanners detect SQLi
    // via ResponseAnalysisAssertion (looks for "syntax error", "PostgreSQL", etc.)
    res.status(500).json({ error: 'Search failed', details: err.message || String(err) });
  }
});

export default router;
