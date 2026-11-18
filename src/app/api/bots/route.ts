import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth";
import { generateApiKey, KeyType } from "@/lib/api-keys";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const botCreateSchema = z.object({
  name: z.string().min(1, "Bot name is required").max(100),
  systemPrompt: z.string().min(1, "System prompt is required"),
  model: z.string().default("gemini-3.5-flash-lite"),
  allowedDomains: z.union([z.string(), z.array(z.string())]).default("*").transform((v) => Array.isArray(v) ? v.join(",") : v),
  websiteUrl: z.string().optional().nullable().or(z.literal("")),
  lastCrawledAt: z.union([z.string(), z.date()]).optional().nullable().transform((v) => (v ? new Date(v) : null)),
  widgetConfig: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export async function GET() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bots = await prisma.bot.findMany({
    where: { userId: session.userId },
    include: {
      apiKeys: {
        select: {
          id: true,
          keyPrefix: true,
          type: true,
          rateLimitPerMinute: true,
          createdAt: true,
        },
      },
      _count: {
        select: { usageLogs: true, knowledgeDocs: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ bots });
}

export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parse = botCreateSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parse.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const newBot = await prisma.bot.create({
      data: {
        userId: session.userId,
        ...parse.data,
      },
    });

    // Automatically provision an initial PUBLIC_WIDGET API key so the bot's widget embed code works out of the box
    const generatedKey = generateApiKey(KeyType.PUBLIC_WIDGET);
    await prisma.apiKey.create({
      data: {
        botId: newBot.id,
        userId: session.userId,
        keyPrefix: generatedKey.keyPrefix,
        keyHash: generatedKey.keyHash,
        type: KeyType.PUBLIC_WIDGET,
        rateLimitPerMinute: 60,
      },
    });

    return NextResponse.json({
      success: true,
      bot: newBot,
      initialApiKey: generatedKey.rawKey,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create bot" }, { status: 500 });
  }
}
