import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAuth, checkWorkspaceMember } from '@/lib/auth';

function safeJson(s, f = {}) { if (!s) return f; try { return JSON.parse(s); } catch { return f; } }

export async function GET(req, { params }) {
  try {
    const user = requireAuth(req);
    const { workspaceId } = await params;
    checkWorkspaceMember(user.id, workspaceId);
    const logs = db.prepare('SELECT id, tool_name, args, result, success, created_at FROM tool_logs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 50').all(workspaceId);
    return NextResponse.json(logs.map(l => ({ ...l, args: safeJson(l.args), result: safeJson(l.result) })));
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 401 }); }
}
