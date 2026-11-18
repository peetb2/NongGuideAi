import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const botUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  systemPrompt: z.string().min(1).optional(),
  model: z.string().optional(),
  allowedDomains: z.union([z.string(), z.array(z.string())]).optional().transform((v) => (v ? (Array.isArray(v) ? v.join(",") : v) : undefined)),
  websiteUrl: z.string().optional().nullable().or(z.literal("")),
  lastCrawledAt: z.union([z.string(), z.date()]).optional().nullable().transform((v) => (v ? new Date(v) : undefined)),
  widgetConfig: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.bot.findUnique({
    where: { id: params.id },
    select: { userId: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  if (existing.userId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bot = await prisma.bot.findFirst({
    where: { id: params.id, userId: session.userId },
    include: {
      apiKeys: {
        where: { userId: session.userId },
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
  });

  if (!bot) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  return NextResponse.json({ bot });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parse = botUpdateSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parse.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const bot = await prisma.bot.findUnique({
      where: { id: params.id },
      select: { id: true, userId: true },
    });

    if (!bot) {
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }

    if (bot.userId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updatedBot = await prisma.bot.update({
      where: { id: params.id, userId: session.userId },
      data: parse.data,
    });

    return NextResponse.json({ success: true, bot: updatedBot });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update bot" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bot = await prisma.bot.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true },
  });

  if (!bot) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  if (bot.userId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.bot.delete({
    where: { id: params.id, userId: session.userId },
  });

  return NextResponse.json({ success: true });
}
