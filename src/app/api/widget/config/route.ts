import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/api-keys";
import { prisma } from "@/lib/prisma";

function corsHeaders(_origin?: string) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, Accept, Cache-Control, X-Requested-With",
    "Access-Control-Max-Age": "86400",
  };
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || undefined;
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin") || req.headers.get("referer") || undefined;
  const headerApiKey =
    req.headers.get("x-api-key") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  const key = (
    req.nextUrl.searchParams.get("key") ||
    req.nextUrl.searchParams.get("publicKey") ||
    req.nextUrl.searchParams.get("apiKey") ||
    req.nextUrl.searchParams.get("botKey") ||
    headerApiKey ||
    ""
  ).trim();
  const botId = (
    req.nextUrl.searchParams.get("botId") ||
    req.nextUrl.searchParams.get("bot") ||
    ""
  ).trim();

  if (!key && !botId) {
    return NextResponse.json(
      { error: "API key or botId is required" },
      { status: 400, headers: corsHeaders(origin) }
    );
  }

  const requestHost =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host || undefined;
  const verification = await verifyApiKey(key, {
    originDomain: origin,
    requestHost,
    botId: botId || undefined,
  });
  if (!verification.valid) {
    const statusCode = verification.errorCode === "DOMAIN_NOT_ALLOWED" ? 403 : 401;
    return NextResponse.json(
      { error: verification.errorMessage, code: verification.errorCode },
      { status: statusCode, headers: corsHeaders(origin) }
    );
  }

  const { bot } = verification;

  let parsedConfig: any = null;
  if (bot.widgetConfig) {
    try {
      parsedConfig = JSON.parse(bot.widgetConfig);
    } catch (e) {
      // ignore JSON parse error
    }
  }

  // Fallback defaults
  const config = {
    primaryColor: parsedConfig?.primaryColor || "#334539",
    launcherColor: parsedConfig?.launcherColor || parsedConfig?.primaryColor || "#334539",
    position: parsedConfig?.position || "right",
    botName: parsedConfig?.botName || bot.name || "Support Agent",
    botSubtitle: parsedConfig?.botSubtitle || "พร้อมให้บริการ 24 ชม.",
    avatarUrl: parsedConfig?.avatarUrl || "",
    greetingMessage: parsedConfig?.greetingMessage || "สวัสดีครับ! มีอะไรให้ผมช่วยเหลือวันนี้ไหมครับ?",
    placeholderText: parsedConfig?.placeholderText || "พิมพ์คำถามของคุณที่นี่...",
    quickPrompts: parsedConfig?.quickPrompts || [
      "สอบถามโปรโมชั่น",
      "เวลาเช็คอิน / เช็คเอาต์",
      "ติดต่อเจ้าหน้าที่",
    ],
    enableStreaming: parsedConfig?.enableStreaming !== false,
    showSources: Boolean(parsedConfig?.showSources === true),
    themePreset: parsedConfig?.themePreset || "sage",
  };

  return NextResponse.json(
    { success: true, botId: bot.id, botName: bot.name, config },
    { status: 200, headers: corsHeaders(origin) }
  );
}
