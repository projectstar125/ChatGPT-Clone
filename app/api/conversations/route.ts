import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
export async function GET() {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const conversations = await db.conversation.findMany({ where: { userId: user.id }, orderBy: { updatedAt: 'desc' }, take: 100, select: { id: true, title: true, updatedAt: true } });
  return NextResponse.json({ conversations });
}
