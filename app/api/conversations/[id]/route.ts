import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkOrigin } from '@/lib/http';
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const conversation = await db.conversation.findFirst({ where: { id, userId: user.id }, include: { messages: { orderBy: { createdAt: 'asc' }, select: { id: true, role: true, content: true, promptTokens: true, completionTokens: true, totalCost: true, usageStatus: true, createdAt: true } } } });
  if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  return NextResponse.json({ conversation: { id: conversation.id, title: conversation.title, messages: conversation.messages.map(m => ({ ...m, totalCost: Number(m.totalCost) })) } });
}
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const result = await db.conversation.deleteMany({ where: { id, userId: user.id } });
  return result.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
}
