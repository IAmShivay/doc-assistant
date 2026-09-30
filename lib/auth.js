import jwt from 'jsonwebtoken';
import db from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyAuth(req) {
  const header = req.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(header.slice(7), JWT_SECRET);
  } catch {
    return null;
  }
}

export function requireAuth(req) {
  const user = verifyAuth(req);
  if (!user) throw new Error('Unauthorized');
  return user;
}

export function checkWorkspaceMember(userId, workspaceId) {
  const member = db.prepare('SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(workspaceId, userId);
  if (!member) throw new Error('Not a workspace member');
}
