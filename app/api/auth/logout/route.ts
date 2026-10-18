import { NextResponse } from 'next/server';
import { destroyCurrentSession } from '@/lib/auth';
import { checkOrigin } from '@/lib/http';
export async function POST(req: Request) { if (!checkOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 }); await destroyCurrentSession(); return NextResponse.json({ ok: true }); }
