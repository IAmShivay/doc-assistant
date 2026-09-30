import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import db from '@/lib/db';
import { requireAuth, checkWorkspaceMember } from '@/lib/auth';

export async function DELETE(req, { params }) {
  try {
    const user = requireAuth(req);
    const { workspaceId, docId } = await params;
    checkWorkspaceMember(user.id, workspaceId);
    const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND workspace_id = ?').get(docId, workspaceId);
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    db.prepare('DELETE FROM chunks WHERE document_id = ?').run(docId);
    db.prepare('DELETE FROM documents WHERE id = ?').run(docId);
    const fp = path.join(process.cwd(), 'data', 'uploads', doc.filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: e.message }, { status: 401 }); }
}
