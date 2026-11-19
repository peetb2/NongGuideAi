import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { verifyApiKey } from "@/lib/api-keys";
import { prisma } from "@/lib/prisma";
import {
  generateEmbedding,
  retrieveTopKChunks,
  synthesizeRagPrompt,
  sanitizeHistory,
  buildRetrievalQuery,
  resolveOwnerPrompt,
} from "@/lib/rag-engine";

// Zod schema for payload validation
const chatRequestSchema = z.object({
  publicKey: z.string().optional(),
  botKey: z.string().optional(),
  apiKey: z.string().optional(),
  key: z.string().optional(),
  botId: z.string().optional(),
  bot: z.string().optional(),
  message: z.string().min(1, "message cannot be empty").max(4000, "message is too long"),
  sessionId: z.string().optional(),
  stream: z.boolean().optional(),
  // Previous turns (oldest first, current message excluded). Sanitized/capped server-side.
  history: z
    .array(
      z.object({
        role: z.string(),
        text: z.string().max(8000),
      })
    )
    .max(50)
    .optional(),
});

// Helper for CORS response headers (allow all external domains to call widget endpoints)
function corsHeaders(_origin?: string) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, Accept, Cache-Control, X-Requested-With",
    "Access-Control-Max-Age": "86400",
  };
}

// OPTIONS preflight handler
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") || undefined;
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

// POST handler for widget chat
export async function POST(req: NextRequest) {
  const originHeader = req.headers.get("origin") || req.headers.get("referer") || undefined;

  try {
    const jsonBody = await req.json().catch(() => ({}));
    
    // 1. Zod input validation
    const validationResult = chatRequestSchema.safeParse(jsonBody);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400, headers: corsHeaders(originHeader) }
      );
    }

    const { publicKey, botKey, apiKey: bodyApiKey, key: bodyKey, botId, bot: bodyBot, message } = validationResult.data;
    const headerApiKey =
      req.headers.get("x-api-key") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
      "";
    const queryApiKey =
      req.nextUrl.searchParams.get("key") ||
      req.nextUrl.searchParams.get("apiKey") ||
      req.nextUrl.searchParams.get("publicKey") ||
      req.nextUrl.searchParams.get("botKey") ||
      "";

    const rawKey = (
      publicKey ||
      botKey ||
      bodyApiKey ||
      bodyKey ||
      jsonBody.publicKey ||
      jsonBody.botKey ||
      jsonBody.apiKey ||
      jsonBody.key ||
      headerApiKey ||
      queryApiKey ||
      ""
    ).trim();

    const effectiveBotId = (
      botId ||
      bodyBot ||
      jsonBody.botId ||
      jsonBody.bot ||
      req.nextUrl.searchParams.get("botId") ||
      req.nextUrl.searchParams.get("bot") ||
      ""
    ).trim();

    const isStreamRequested = Boolean(
      validationResult.data.stream === true ||
      jsonBody.stream === true ||
      req.nextUrl.searchParams.get("stream") === "true" ||
      req.headers.get("accept")?.includes("text/event-stream")
    );

    // 2. Validate API key against DB & active status
    const requestHost =
      req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host || undefined;
    const keyVerification = await verifyApiKey(rawKey, {
      originDomain: originHeader,
      requestHost,
      botId: effectiveBotId || undefined,
    });
    if (!keyVerification.valid) {
      const statusCode = keyVerification.errorCode === "DOMAIN_NOT_ALLOWED" ? 403 : 401;
      return NextResponse.json(
        {
          error: keyVerification.errorMessage,
          code: keyVerification.errorCode,
        },
        { status: statusCode, headers: corsHeaders(originHeader) }
      );
    }

    const { bot, apiKey, user } = keyVerification;

    // 3. Quota check: user credit balance
    if (user.creditBalance <= 0) {
      return NextResponse.json(
        {
          error: "Insufficient credits. The chatbot owner has exhausted their credit balance.",
          code: "CREDITS_EXHAUSTED",
        },
        { status: 429, headers: corsHeaders(originHeader) }
      );
    }

    // 4. Flow B: Vectorize User Query & Retrieve Top-K Context Chunks from Vector DB
    //    Follow-up questions are rewritten into standalone queries using recent history.
    const history = sanitizeHistory(validationResult.data.history);
    const retrievalQuery = await buildRetrievalQuery(message, history);
    const queryEmbedding = await generateEmbedding(retrievalQuery);
    const retrievedChunks = await retrieveTopKChunks(bot.id, queryEmbedding, 4, 0.45);

    // 5. Synthesize Combined Prompt (Tourism persona + owner instructions + KM Context + history + User Query)
    const sanitizedPrompt = resolveOwnerPrompt(bot.systemPrompt, bot.name);
    const combinedPrompt = synthesizeRagPrompt(sanitizedPrompt, retrievedChunks, message, {
      botName: bot.name,
      history,
    });

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey || geminiApiKey.trim().length === 0) {
      console.error("[LLM Error] Missing GEMINI_API_KEY environment variable");
      return NextResponse.json(
        {
          error: "Chat service configuration error: GEMINI_API_KEY is missing.",
          code: "CONFIG_ERROR",
        },
        { status: 500, headers: corsHeaders(originHeader) }
      );
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);

    // Candidate models fallback list
    const activeBotModel =
      bot.model === "gemini-1.5-flash" || bot.model === "gemini-2.5-flash-lite"
        ? "gemini-3.5-flash-lite"
        : bot.model === "gemini-1.5-pro"
        ? "gemini-3.8-flash"
        : bot.model || "gemini-3.5-flash-lite";

    const candidateModels = [
      activeBotModel,
      "gemini-3.5-flash-lite",
      "gemini-3.8-flash",
      "gemini-flash-latest",
      "gemini-3.5-flash",
    ].filter((m): m is string => Boolean(m && m.trim().length > 0));

    const uniqueModels = Array.from(new Set(candidateModels));

    // Handle Streaming Response (Server-Sent Events)
    if (isStreamRequested) {
      const encoder = new TextEncoder();
      const promptTokens = combinedPrompt.length;

      const stream = new ReadableStream({
        async start(controller) {
          let fullReply = "";
          let streamSuccess = false;
          let lastError: any = null;

          for (const modelName of uniqueModels) {
            try {
              const model = genAI.getGenerativeModel({ model: modelName });
              const result = await model.generateContentStream(combinedPrompt);

              for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                if (chunkText) {
                  const cleanChunk = chunkText.replace(/\*\*/g, "");
                  fullReply += cleanChunk;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: "chunk", text: cleanChunk })}\n\n`)
                  );
                }
              }

              if (fullReply.trim().length > 0) {
                streamSuccess = true;
                break;
              }
            } catch (err: any) {
              lastError = err;
              console.warn(`[Stream LLM Model ${modelName} Warning]:`, err?.message || err);
            }
          }

          if (!streamSuccess || !fullReply.trim()) {
            const fallbackMsg = "ขออภัยครับ ขณะนี้ระบบประมวลผลข้อความขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง";
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "error", error: fallbackMsg })}\n\n`)
            );
            controller.close();
            return;
          }

          try {
            // Deduct 1 credit & log usage in database
            const [updatedUser] = await prisma.$transaction([
              prisma.user.update({
                where: { id: user.id },
                data: { creditBalance: { decrement: 1 } },
              }),
              prisma.usageLog.create({
                data: {
                  userId: user.id,
                  botId: bot.id,
                  apiKeyId: apiKey.id,
                  messageCount: 1,
                  promptTokens: promptTokens,
                  completionTokens: fullReply.length,
                  originDomain: originHeader || "direct",
                },
              }),
            ]);

            // Send done metadata
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "done",
                  reply: fullReply,
                  creditsRemaining: updatedUser.creditBalance,
                  botName: bot.name,
                })}\n\n`
              )
            );
          } catch (dbErr) {
            console.error("[Stream DB Logging Error]", dbErr);
          }

          controller.close();
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          ...corsHeaders(originHeader),
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // Standard Non-Streaming JSON Fallback
    let replyText = "";
    let promptTokens = combinedPrompt.length;
    let completionTokens = 0;
    let lastLlmError: any = null;

    for (const modelName of uniqueModels) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(combinedPrompt);
        const candidateReply = result.response.text();
        if (candidateReply && candidateReply.trim().length > 0) {
          replyText = candidateReply.replace(/\*\*/g, "").trim();
          completionTokens = replyText.length;
          break;
        }
      } catch (err: any) {
        lastLlmError = err;
        console.warn(`[LLM Model ${modelName} Warning]:`, err?.message || err);
      }
    }

    if (!replyText) {
      console.error("[LLM Failure] All candidate Gemini models failed to generate content:", lastLlmError);
      return NextResponse.json(
        {
          error: "ขออภัยครับ ขณะนี้ระบบประมวลผลข้อความขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง",
          details: lastLlmError?.message || "LLM execution failure",
        },
        { status: 502, headers: corsHeaders(originHeader) }
      );
    }

    // Deduct 1 credit & log usage in database
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { creditBalance: { decrement: 1 } },
      }),
      prisma.usageLog.create({
        data: {
          userId: user.id,
          botId: bot.id,
          apiKeyId: apiKey.id,
          messageCount: 1,
          promptTokens: promptTokens,
          completionTokens: completionTokens,
          originDomain: originHeader || "direct",
        },
      }),
    ]);

    // Return success response with credits
    return NextResponse.json(
      {
        reply: replyText,
        creditsRemaining: updatedUser.creditBalance,
        botName: bot.name,
      },
      { status: 200, headers: corsHeaders(originHeader) }
    );

  } catch (error: any) {
    console.error("[API Gateway Error]", error);
    return NextResponse.json(
      {
        error: "Internal server error occurred while processing message.",
        details: error?.message,
      },
      { status: 500, headers: corsHeaders(originHeader) }
    );
  }
}
