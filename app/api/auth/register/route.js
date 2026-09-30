import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '@/lib/db';
import { signToken } from '@/lib/auth';

export async function POST(req) {
  try {
    const { email, password } = await req.json();
    if (!email || !password || password.length < 6) return NextResponse.json({ error: 'Email and password (min 6 chars) required' }, { status: 400 });
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    const id = uuidv4(), wsId = uuidv4(), hash = bcrypt.hashSync(password, 10);
    await db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(id, email, hash);
    await db.prepare('INSERT INTO workspaces (id, name, owner_id) VALUES (?, ?, ?)').run(wsId, 'My Workspace', id);
    await db.prepare('INSERT INTO workspace_members (workspace_id, user_id) VALUES (?, ?)').run(wsId, id);
    return NextResponse.json({ token: signToken({ id, email }), user: { id, email } });
  } catch (e) { console.error(e); return NextResponse.json({ error: 'Registration failed' }, { status: 500 }); }
}
