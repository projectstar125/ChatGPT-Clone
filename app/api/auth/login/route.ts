import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { checkOrigin, jsonError } from '@/lib/http';
import { rateLimit } from '@/lib/rate-limit';
const schema = z.object({ email: z.string().email().max(254).transform(v => v.toLowerCase()), password: z.string().min(1).max(128) });
export async function POST(req: Request) {
  if (!checkOrigin(req)) return jsonError('Invalid origin', 403);
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!rateLimit(`login:${ip}`, 10, 900000).allowed) return jsonError('Too many login attempts', 429);
  const parsed = schema.safeParse(await req.json().catch(() => null)); if (!parsed.success) return jsonError('Invalid email or password');
  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return jsonError('Invalid email or password', 401);
  await createSession(user.id);
  return NextResponse.json({ user: { id: user.id, email: user.email, role: user.role } });
}
