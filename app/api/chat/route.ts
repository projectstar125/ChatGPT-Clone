
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { checkOrigin, jsonError } from '@/lib/http';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 120;

const schema = z.object({
  conversationId: z.string().optional().nullable(),
  message: z.string().trim().min(1).max(20000),
});

const enc = new TextEncoder();

function event(type: string, data: unknown) {
  return enc.encode(
    `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`,
  );
}

function calculateGeminiCost(inputTokens: number, outputTokens: number) {
  const inputRate = Number(
    process.env.GEMINI_INPUT_PRICE_PER_MILLION ?? '0',
  );
  const outputRate = Number(
    process.env.GEMINI_OUTPUT_PRICE_PER_MILLION ?? '0',
  );

  if (
    ![inputRate, outputRate].every(
      (n) => Number.isFinite(n) && n >= 0,
    )
  ) {
    throw new Error('Invalid Gemini pricing configuration');
  }

  return (
    (inputTokens * inputRate + outputTokens * outputRate) /
    1_000_000
  );
}

export async function POST(req: Request) {
  if (!checkOrigin(req)) {
    return jsonError('Invalid origin', 403);
  }

  const user = await getCurrentUser();

  if (!user) {
    return jsonError('Unauthorized', 401);
  }

  if (!rateLimit(`chat:${user.id}`, 20, 60000).allowed) {
    return jsonError('Rate limit exceeded. Please wait a minute.', 429);
  }

  const parsed = schema.safeParse(
    await req.json().catch(() => null),
  );

  if (!parsed.success) {
    return jsonError('Message must contain 1–20,000 characters');
  }

  if (!process.env.GEMINI_API_KEY) {
    return jsonError('Gemini API is not configured', 503);
  }

  const { message } = parsed.data;

  let conversation;

  if (parsed.data.conversationId) {
    conversation = await db.conversation.findFirst({
      where: {
        id: parsed.data.conversationId,
        userId: user.id,
      },
    });

    if (!conversation) {
      return jsonError('Conversation not found', 404);
    }
  } else {
    conversation = await db.conversation.create({
      data: {
        userId: user.id,
        title:
          message.slice(0, 64).replace(/\s+/g, ' ') || 'New chat',
      },
    });
  }

  const prior = await db.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
    take: 40,
    select: { role: true, content: true },
  });

  const userMessage = await db.message.create({
    data: {
      conversationId: conversation.id,
      role: 'USER',
      content: message,
      usageStatus: 'not_applicable',
    },
  });

  const assistantMessage = await db.message.create({
    data: {
      conversationId: conversation.id,
      role: 'ASSISTANT',
      content: '',
      usageStatus: 'pending',
    },
  });

  await db.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  const model =
    process.env.GEMINI_MODEL || 'gemini-3.8-flash';

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const contents = [
    ...prior
      .filter((m) => m.content.trim().length > 0)
      .map((m) => ({
        role: m.role === 'USER' ? 'user' as const : 'model' as const,
        parts: [{ text: m.content }],
      })),
    {
      role: 'user' as const,
      parts: [{ text: message }],
    },
  ];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let content = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let sawUsage = false;

      try {
        controller.enqueue(
          event('meta', {
            conversationId: conversation!.id,
            userMessageId: userMessage.id,
            assistantMessageId: assistantMessage.id,
          }),
        );

        const response = await ai.models.generateContentStream({
          model,
          contents,
          config: {
            systemInstruction:
              'You are a helpful, accurate assistant. Format answers with Markdown when useful. If uncertain, say so.',
          },
        });

        for await (const chunk of response) {
          if (req.signal.aborted) {
            throw new Error('Client disconnected');
          }

          const delta = chunk.text;

          if (typeof delta === 'string' && delta.length > 0) {
            content += delta;
            controller.enqueue(event('delta', { text: delta }));
          }

          const usage = chunk.usageMetadata;

          if (usage) {
            if (typeof usage.promptTokenCount === 'number') {
              inputTokens = usage.promptTokenCount;
              sawUsage = true;
            }

            if (typeof usage.candidatesTokenCount === 'number') {
              outputTokens = usage.candidatesTokenCount;
              sawUsage = true;
            }
          }
        }

        const cost = sawUsage
          ? calculateGeminiCost(inputTokens, outputTokens)
          : 0;

        await db.$transaction(async (tx) => {
          await tx.message.update({
            where: { id: assistantMessage.id },
            data: {
              content,
              promptTokens: inputTokens,
              completionTokens: outputTokens,
              totalCost: cost,
              usageStatus: sawUsage
                ? 'complete'
                : 'usage_unavailable',
            },
          });

          if (sawUsage) {
            await tx.userTokenUsage.upsert({
              where: { userId: user!.id },
              create: {
                userId: user!.id,
                totalTokensUsed: BigInt(inputTokens + outputTokens),
                totalSpentUSD: cost,
              },
              update: {
                totalTokensUsed: {
                  increment: BigInt(inputTokens + outputTokens),
                },
                totalSpentUSD: { increment: cost },
              },
            });
          }

          await tx.conversation.update({
            where: { id: conversation!.id },
            data: { updatedAt: new Date() },
          });
        });

        controller.enqueue(
          event('done', {
            conversationId: conversation!.id,
            assistantMessageId: assistantMessage.id,
            usage: sawUsage
              ? {
                inputTokens,
                outputTokens,
                totalTokens: inputTokens + outputTokens,
                estimatedCostUSD: cost,
                model,
              }
              : null,
          }),
        );
      } catch (error) {
        const messageText =
          error instanceof Error ? error.message : 'Unknown streaming error';

        await db.message
          .update({
            where: { id: assistantMessage.id },
            data: {
              content,
              promptTokens: inputTokens,
              completionTokens: outputTokens,
              usageStatus: sawUsage ? 'partial' : 'unknown',
            },
          })
          .catch(() => undefined);

        if (!req.signal.aborted) {
          try {
            controller.enqueue(
              event('error', {
                error:
                  'Gemini could not complete the response. Check the server terminal for details.',
              }),
            );
          } catch {
            // The client may have disconnected.
          }
        }

        console.error('Gemini stream failed:', messageText);
      } finally {
        try {
          controller.close();
        } catch {
          // The stream may already be closed.
        }
      }
    },

    cancel() {
      // Preserve any partial response if the upstream request fails.
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
