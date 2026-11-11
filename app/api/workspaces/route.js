import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req) {
  try {
    const user = requireAuth(req);
    const workspaces = await db.prepare('SELECT w.id, w.name, w.owner_id, w.created_at FROM workspaces w JOIN workspace_members wm ON w.id = wm.workspace_id WHERE wm.user_id = ? ORDER BY w.created_at').all(user.id);
    return NextResponse.json(workspaces);
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}

export async function POST(req) {
  try {
    const user = requireAuth(req);
    const { name } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    const id = uuidv4();
    await db.prepare('INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)').run(id, name.trim(), user.id);
    await db.prepare('INSERT INTO workspace_members (workspace_id, user_id) VALUES (?, ?)').run(id, user.id);
    const ws = await db.prepare('SELECT id, name, owner_id, created_at FROM workspaces WHERE id = ?').get(id);
    return NextResponse.json(ws, { status: 201 });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 401 }); }
}
