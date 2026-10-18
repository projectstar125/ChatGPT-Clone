import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
export async function GET() {
  const user = await getCurrentUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [usage, requests] = await Promise.all([
    db.userTokenUsage.findUnique({ where: { userId: user.id } }),
    db.message.findMany({ where: { role: 'ASSISTANT', conversation: { userId: user.id }, usageStatus: { in: ['complete','partial','usage_unavailable','unknown'] } }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, promptTokens: true, completionTokens: true, totalCost: true, usageStatus: true, createdAt: true, conversation: { select: { title: true } } } }),
  ]);
  return NextResponse.json({ totalTokensUsed: String(usage?.totalTokensUsed ?? 0), totalSpentUSD: Number(usage?.totalSpentUSD ?? 0), requests: requests.map(r => ({ ...r, totalCost: Number(r.totalCost) })) });
}
