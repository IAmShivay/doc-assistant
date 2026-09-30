import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from './db.js';
import { authMiddleware } from './auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', (req, res) => {
  const workspaces = db.prepare(`
    SELECT w.* FROM workspaces w
    JOIN workspace_members wm ON w.id = wm.workspace_id
    WHERE wm.user_id = ?
    ORDER BY w.created_at
  `).all(req.user.id);
  res.json(workspaces);
});

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Workspace name required' });
  }
  const id = uuidv4();
  db.prepare('INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)').run(id, name.trim(), req.user.id);
  db.prepare('INSERT INTO workspace_members (workspace_id, user_id) VALUES (?, ?)').run(id, req.user.id);
  const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id);
  res.status(201).json(workspace);
});

router.get('/:id', (req, res) => {
  const member = db.prepare('SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!member) return res.status(403).json({ error: 'Not a member' });

  const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(req.params.id);
  if (!workspace) return res.status(404).json({ error: 'Not found' });
  res.json(workspace);
});

router.delete('/:id', (req, res) => {
  const ws = db.prepare('SELECT * FROM workspaces WHERE id = ? AND owner_id = ?').get(req.params.id, req.user.id);
  if (!ws) return res.status(403).json({ error: 'Not owner or not found' });

  db.prepare('DELETE FROM workspaces WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export function requireWorkspaceMember(req, res, next) {
  const workspaceId = req.params.workspaceId || req.body.workspaceId || req.query.workspaceId;
  if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });

  const member = db.prepare('SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(workspaceId, req.user.id);
  if (!member) return res.status(403).json({ error: 'Not a workspace member' });

  req.workspaceId = workspaceId;
  next();
}

export default router;
