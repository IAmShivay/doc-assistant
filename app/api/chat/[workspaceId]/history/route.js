import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAuth, checkWorkspaceMember } from '@/lib/auth';

function safeJson(str, fallback = {}) { if (!str) return fallback; try { return JSON.parse(str); } catch { return fallback; } }

export async function GET(req, { params }) {
  try {
    const user = requireAuth(req);
    const { workspaceId } = await params;
    await checkWorkspaceMember(user.id, workspaceId);
    const msgs = await db.prepare('SELECT id, role, content, citations, created_at FROM messages WHERE workspace_id = ? AND user_id = ? ORDER BY created_at').all(workspaceId, user.id);
    return NextResponse.json(msgs.map(m => ({ ...m, citations: safeJson(m.citations, []) })));
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 401 }); }
}

export async function DELETE(req, { params }) {
  try {
    const user = requireAuth(req);
    const { workspaceId } = await params;
    await checkWorkspaceMember(user.id, workspaceId);
    await db.prepare('DELETE FROM messages WHERE workspace_id = ? AND user_id = ?').run(workspaceId, user.id);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 401 }); }
}
