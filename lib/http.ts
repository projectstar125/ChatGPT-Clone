import { NextResponse } from 'next/server';
export function jsonError(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }
export function checkOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const expected = process.env.APP_URL;
  if (!origin || !expected) return true;
  try { return new URL(origin).origin === new URL(expected).origin; } catch { return false; }
}
