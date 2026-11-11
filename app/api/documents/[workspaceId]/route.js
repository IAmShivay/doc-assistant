import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAuth, checkWorkspaceMember } from '@/lib/auth';

export async function GET(req, { params }) {
  try {
    const user = requireAuth(req);
    const { workspaceId } = await params;
    await checkWorkspaceMember(user.id, workspaceId);
    const docs = await db.prepare('SELECT id, filename, original_name, created_at FROM documents WHERE workspace_id = ? ORDER BY created_at DESC').all(workspaceId);
    return NextResponse.json(docs);
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 401 }); }
}
