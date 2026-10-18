import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { checkOrigin, jsonError } from '@/lib/http';
import { rateLimit } from '@/lib/rate-limit';
const schema = z.object({ email: z.string().email().max(254).transform(v => v.toLowerCase()), password: z.string().min(10).max(128) });
export async function POST(req: Request) {
  if (!checkOrigin(req)) return jsonError('Invalid origin', 403);
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`register:${ip}`, 5, 3600000).allowed) return jsonError('Too many registration attempts', 429);
  const parsed = schema.safeParse(await req.json().catch(() => null)); if (!parsed.success) return jsonError('Provide a valid email and a password of at least 10 characters');
  try {
    const email = parsed.data.email;
    // Never assign privileged roles based on a public registration email field or env allowlist.
    const user = await db.user.create({ data: { email, passwordHash: await bcrypt.hash(parsed.data.password, 12), role: 'USER', usage: { create: {} } } });
    await createSession(user.id);
    return NextResponse.json({ user: { id: user.id, email: user.email, role: user.role } }, { status: 201 });
  } catch (e) { if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') return jsonError('An account with this email already exists', 409); return jsonError('Unable to create account', 500); }
}
