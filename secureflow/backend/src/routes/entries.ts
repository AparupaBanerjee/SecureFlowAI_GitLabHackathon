import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { VaultEntry } from '../models/index';

const router = Router();
router.use(authenticate);

// GET /api/entries — list own entries (password field omitted)
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const entries = await VaultEntry.findAll({
      where: { userId: req.user!.id },
      attributes: ['id', 'name', 'username', 'url', 'notes', 'createdAt', 'updatedAt'],
    });
    res.json(entries);
  } catch {
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

// POST /api/entries — create entry
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, username, password, url, notes } = req.body;
    if (!name || !password) {
      res.status(400).json({ error: 'name and password are required' });
      return;
    }
    const entry = await VaultEntry.create({
      userId: req.user!.id,
      name,
      username: username || '',
      password,
      url: url || '',
      notes: notes || '',
    });
    res.status(201).json({ id: entry.id, name: entry.name });
  } catch {
    res.status(500).json({ error: 'Failed to create entry' });
  }
});

// PUT /api/entries/:id — update own entry
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const entry = await VaultEntry.findByPk(req.params.id);
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    if (entry.userId !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    await entry.update(req.body);
    res.json({ id: entry.id, name: entry.name });
  } catch {
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

// DELETE /api/entries/:id — delete own entry
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const entry = await VaultEntry.findByPk(req.params.id);
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' });
      return;
    }
    if (entry.userId !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    await entry.destroy();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

export default router;
