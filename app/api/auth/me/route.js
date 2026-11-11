import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(req) {
  try {
    const user = requireAuth(req);
    return NextResponse.json({ user });
  } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
}
