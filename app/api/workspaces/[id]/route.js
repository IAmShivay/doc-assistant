import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function DELETE(req, { params }) {
  try {
    const user = requireAuth(req);
    const { id } = await params;
    const ws = db.prepare('SELECT * FROM workspaces WHERE id = ? AND owner_id = ?').get(id, user.id);
    if (!ws) return NextResponse.json({ error: 'Not found or not owner' }, { status: 403 });
    db.prepare('DELETE FROM workspaces WHERE id = ?').run(id);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 401 }); }
}
