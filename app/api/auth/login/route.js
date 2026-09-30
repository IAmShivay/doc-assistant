import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db from '@/lib/db';
import { signToken } from '@/lib/auth';

export async function POST(req) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    return NextResponse.json({ token: signToken({ id: user.id, email: user.email }), user: { id: user.id, email: user.email } });
  } catch (e) { console.error(e); return NextResponse.json({ error: 'Login failed' }, { status: 500 }); }
}
