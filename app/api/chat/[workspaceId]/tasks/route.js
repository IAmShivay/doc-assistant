import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAuth, checkWorkspaceMember } from '@/lib/auth';

export async function GET(req, { params }) {
  try {
    const user = requireAuth(req);
    const { workspaceId } = await params;
    checkWorkspaceMember(user.id, workspaceId);
    const tasks = db.prepare('SELECT * FROM tasks WHERE workspace_id = ? ORDER BY created_at DESC').all(workspaceId);
    return NextResponse.json(tasks);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 401 }); }
}
