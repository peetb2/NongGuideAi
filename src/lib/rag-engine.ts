import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "./prisma";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * 768-dimensional text chunker for RAG ingestion
 * Splits text into semantic chunks with overlap to preserve context across boundaries
 */
export function chunkText(
  text: string,
  maxChunkSize: number = 750,
  overlap: number = 120
): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  if (cleaned.length <= maxChunkSize) {
    return [cleaned];
  }

  const chunks: string[] = [];
  const paragraphs = cleaned.split(/\n\s*\n/);
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const trimmedPara = paragraph.trim();
    if (!trimmedPara) continue;

    if ((currentChunk + "\n\n" + trimmedPara).length <= maxChunkSize) {
      currentChunk = currentChunk ? currentChunk + "\n\n" + trimmedPara : trimmedPara;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }

      // If the paragraph itself is larger than maxChunkSize, split by sentences or words
      if (trimmedPara.length > maxChunkSize) {
        const sentences = trimmedPara.split(/(?<=[.!?。！？\n])\s+/);
        let subChunk = "";

        for (const sentence of sentences) {
          if ((subChunk + " " + sentence).length <= maxChunkSize) {
            subChunk = subChunk ? subChunk + " " + sentence : sentence;
          } else {
            if (subChunk) chunks.push(subChunk);
            subChunk = sentence;
          }
        }
        currentChunk = subChunk;
      } else {
        // Carry over overlap from previous chunk end
        const overlapSnippet = currentChunk.slice(-overlap);
        currentChunk = overlapSnippet ? `${overlapSnippet}...\n\n${trimmedPara}` : trimmedPara;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Deterministic fallback embedding generator (768-dim) for testing or offline environments
 */
function generateDeterministicEmbedding(text: string, dimensions = 768): number[] {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  const vec: number[] = new Array(dimensions);
  for (let i = 0; i < dimensions; i++) {
    const val = Math.sin(hash + i * 13.37) * Math.cos(i);
    vec[i] = val;
  }
  // Normalize vector to unit length
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

/**
 * Computes vector embedding using Google Gemini embedding models or deterministic fallback
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const isLiveKey = Boolean(
    GEMINI_API_KEY && 
    GEMINI_API_KEY.trim().length > 10 && 
    !GEMINI_API_KEY.includes("mock")
  );

  if (!isLiveKey) {
    return generateDeterministicEmbedding(text);
  }

  const embeddingCandidateModels = ["gemini-embedding-001", "gemini-embedding-2", "text-embedding-004"];

  for (const modelName of embeddingCandidateModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.embedContent(text);
      if (result.embedding && result.embedding.values && result.embedding.values.length > 0) {
        return result.embedding.values;
      }
    } catch (err: any) {
      // Continue to next embedding model
    }
  }

  console.warn("[Embedding Engine Warning] All live embedding models failed, using deterministic fallback.");
  return generateDeterministicEmbedding(text);
}

/**
 * Cosine similarity between two vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

export interface RetrievedChunk {
  id: string;
  documentTitle: string;
  content: string;
  similarity: number;
}

/**
 * Retrieves top-K context chunks for a bot based on cosine similarity
 */
export async function retrieveTopKChunks(
  botId: string,
  queryEmbedding: number[],
  topK: number = 4,
  minSimilarity: number = 0.45
): Promise<RetrievedChunk[]> {
  try {
    const chunks = await prisma.knowledgeChunk.findMany({
      where: { botId },
      include: {
        document: {
          select: { title: true },
        },
      },
    });

    if (chunks.length === 0) {
      return [];
    }

    const scored = chunks
      .map((chunk) => {
        let embeddingVec: number[] = [];
        try {
          if (chunk.embedding) {
            embeddingVec = JSON.parse(chunk.embedding);
          }
        } catch {
          embeddingVec = [];
        }

        const score = (embeddingVec.length > 0 && embeddingVec.length === queryEmbedding.length)
          ? cosineSimilarity(queryEmbedding, embeddingVec)
          : 0;

        return {
          id: chunk.id,
          documentTitle: chunk.document?.title || "เอกสารฐานความรู้",
          content: chunk.content,
          similarity: score,
        };
      })
      .filter((c) => c.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    // If strict threshold filtered out all chunks, check if there are moderately relevant chunks (>= 0.25)
    if (scored.length === 0) {
      const relaxed = chunks
        .map((chunk) => {
          let embeddingVec: number[] = [];
          try {
            if (chunk.embedding) {
              embeddingVec = JSON.parse(chunk.embedding);
            }
          } catch {
            embeddingVec = [];
          }

          const score = (embeddingVec.length > 0 && embeddingVec.length === queryEmbedding.length)
            ? cosineSimilarity(queryEmbedding, embeddingVec)
            : 0;

          return {
            id: chunk.id,
            documentTitle: chunk.document?.title || "เอกสารฐานความรู้",
            content: chunk.content,
            similarity: score,
          };
        })
        .filter((c) => c.similarity >= 0.25)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);

      return relaxed;
    }

    return scored;
  } catch (error) {
    console.error("[Vector DB Retrieval Error]:", error);
    return [];
  }
}

/**
 * Synthesizes the RAG augmented prompt combining:
 * 1. Base bot system prompt & tone instructions
 * 2. Retrieved knowledge base context chunks
 * 3. User message
 *
 * Formatted clearly according to RAG specifications:
 * System: You are Support Agent for this website. Answer user inquiries naturally and accurately based strictly on the provided knowledge base context below. Do NOT simply acknowledge the question or repeat the prompt.
 * 
 * Context:
 * {retrieved_context}
 * 
 * User Question:
 * {user_message}
 */
export function synthesizeRagPrompt(
  systemPrompt: string,
  retrievedChunks: RetrievedChunk[],
  userMessage: string,
  options: SynthesizeOptions = {}
): string {
  const fullSystemInstruction = buildTourismSystemInstruction(options.botName, systemPrompt, options.now);

  let contextContent = "";
  if (retrievedChunks.length > 0) {
    contextContent = retrievedChunks
      .map((chunk, idx) => `[Document ${idx + 1}: ${chunk.documentTitle}]\n${chunk.content}`)
      .join("\n\n---\n\n");
  } else {
    contextContent = "No relevant documents found in knowledge base.";
  }

  const historyBlock = formatHistory(options.history);

  return `System: ${fullSystemInstruction}

Context:
${contextContent}
${historyBlock ? `\nConversation so far (oldest first):\n${historyBlock}\n` : ""}
User Question:
${userMessage}`;
}

/* ------------------------------------------------------------------ */
/*  Tourism specialist persona + conversation memory helpers           */
/* ------------------------------------------------------------------ */

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface SynthesizeOptions {
  /** Display name of the bot; used as the assistant's identity */
  botName?: string;
  /** Previous turns of this conversation, oldest first (current message excluded) */
  history?: ChatTurn[];
  /** Override "now" (for tests) */
  now?: Date;
}

const MAX_HISTORY_TURNS = 10;
const MAX_HISTORY_CHARS = 6000;

// Generic placeholder prompts from older bot templates; ignored so they don't override the tourism persona
const GENERIC_DEFAULT_PROMPTS = [
  "you are a helpful customer support ai assistant for our website.",
  "คุณคือผู้ช่วย ai บริการลูกค้าของ ai charming",
  "คุณคือผู้ช่วย ai บริการลูกค้าของ nongguide ai",
];

/**
 * Cleans the bot owner's custom system prompt: rebrands legacy names and drops
 * generic template prompts that would otherwise override the tourism persona.
 */
export function resolveOwnerPrompt(systemPrompt: string | null | undefined, botName?: string): string {
  const name = (botName || "").trim() || "NongGuide AI";
  const prompt = (systemPrompt || "")
    .replace(/MatchaChatbot/gi, name)
    .replace(/Matcha Chatbot/gi, name)
    .replace(/AI Charming/gi, name)
    .replace(/AI Chaming/gi, name)
    .trim();
  return GENERIC_DEFAULT_PROMPTS.includes(prompt.toLowerCase()) ? "" : prompt;
}

/**
 * Normalizes untrusted history from the widget: keeps valid roles, trims text,
 * keeps only the most recent turns and caps total size to protect prompt length.
 */
export function sanitizeHistory(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];

  const turns: ChatTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = String((item as any).role || "").toLowerCase();
    const text = String((item as any).text ?? (item as any).content ?? "").trim();
    if (!text) continue;
    const role: ChatTurn["role"] | null =
      r === "user" ? "user" : r === "assistant" || r === "bot" || r === "model" ? "assistant" : null;
    if (!role) continue;
    turns.push({ role, text: text.slice(0, 2000) });
  }

  const recent = turns.slice(-MAX_HISTORY_TURNS);

  // Drop oldest turns until we fit the character budget
  let total = recent.reduce((s, t) => s + t.text.length, 0);
  while (recent.length > 0 && total > MAX_HISTORY_CHARS) {
    total -= recent.shift()!.text.length;
  }
  return recent;
}

function formatHistory(history?: ChatTurn[]): string {
  if (!history || history.length === 0) return "";
  return history
    .map((t) => `${t.role === "user" ? "Traveler" : "Assistant"}: ${t.text.replace(/\*\*/g, "")}`)
    .join("\n");
}

/** Current date/time and Thai travel season, so the model can give time-aware advice */
function describeTravelMoment(now: Date = new Date()): string {
  const dateStr = now.toLocaleDateString("en-GB", {
    timeZone: "Asia/Bangkok",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const month = Number(
    now.toLocaleDateString("en-US", { timeZone: "Asia/Bangkok", month: "numeric" })
  );

  let season: string;
  if (month >= 11 || month <= 2) {
    season = "cool & dry HIGH season (Nov-Feb): best weather, busiest and most expensive; book ahead";
  } else if (month >= 3 && month <= 4) {
    season = "HOT season (Mar-Apr): very hot inland; Songkran water festival mid-April; Northern Thailand may have smoke/haze (PM2.5)";
  } else {
    season = "RAINY / green season (May-Oct): afternoon showers, lush scenery, lower prices; some islands/national parks or boat routes may close";
  }

  return `Today is ${dateStr} (Thailand time, UTC+7). Current Thai travel season: ${season}.`;
}

/**
 * Builds the tourism-specialist system instruction.
 * The bot owner's own systemPrompt is appended and takes priority for business-specific details.
 */
export function buildTourismSystemInstruction(
  botName: string | undefined,
  ownerPrompt: string | undefined,
  now?: Date
): string {
  const rawName = (botName || "").trim();
  const name =
    !rawName || /^ai\s*cha(r)?ming$/i.test(rawName)
      ? "NongGuide AI (น้องไกด์ AI)"
      : rawName;

  const persona = `You are ${name}, a friendly, knowledgeable local tourism specialist and travel assistant for this website. You help travelers discover places, plan trips, and get practical travel information. If the user asks who you are, introduce yourself as ${name}. Never call yourself Matcha, Matcha chatbot, AI Charming, or a generic customer-support bot.

${describeTravelMoment(now)}

HOW TO HELP TRAVELERS
1. Answer naturally and directly. Never just acknowledge or repeat the question.
2. Trip planning: if key details are missing (travel dates or number of days, group size and whether there are kids or elderly, budget, interests, how they will get around), ask 1-3 short clarifying questions first. If they have already given enough detail, plan right away and do not over-ask.
3. When recommending places, for each one give: why it is worth visiting, best time of day or season, approximate cost in THB if known, and rough travel time from the previous stop.
4. For itineraries, organize by day with morning / afternoon / evening, group nearby places together to minimize travel, and keep the pace realistic.
5. Give practical local tips when relevant: transport options (Grab/Bolt, songthaew, BTS/MRT, ferries, rental scooters only with a valid licence and helmet), temple dress code (cover shoulders and knees), etiquette, tipping, cash vs QR payment, and safety.
6. Consider the current season and date above (weather, festivals, high/low season pricing). Note that alcohol sales are restricted on major Buddhist holidays and election days.
7. Always reply in the same language the traveler is using (Thai, English, Chinese, Japanese, Korean, etc.). In Thai, use a polite, warm tone.

ACCURACY RULES (very important)
- Base facts about this business (prices, packages, opening hours, contact details, policies, availability) strictly on the knowledge base Context below.
- If the Context does not contain something, say so honestly and suggest the traveler contact the business directly. NEVER invent prices, phone numbers, addresses, opening hours, or availability.
- General, well-known travel knowledge (famous landmarks, culture, typical weather) may be shared, but clearly frame uncertain details as approximate and suggest checking before going.
- Use the "Conversation so far" section to understand follow-up questions (for example "what about with kids?" or "and day 2?") and stay consistent with what you said earlier.

FORMATTING RULE
Do NOT use markdown bold asterisks (**) or any asterisks (*) for emphasis, bullets, or headings. Write clean plain text. Use simple numbered lines or dashes (-) for lists, and short paragraphs that read well in a small chat window.`;

  const owner = (ownerPrompt || "").trim();
  return owner
    ? `${persona}\n\nBUSINESS-SPECIFIC INSTRUCTIONS FROM THE OWNER (follow these; they override the general guidance above when they conflict):\n${owner}`
    : persona;
}

/**
 * Turns a follow-up question into a standalone search query using recent history,
 * so retrieval works for messages like "what about for kids?".
 * Falls back to a simple concatenation if the LLM is unavailable or slow.
 */
export async function buildRetrievalQuery(
  message: string,
  history: ChatTurn[],
  modelName: string = "gemini-3.5-flash-lite",
  timeoutMs: number = 2500
): Promise<string> {
  if (!history || history.length === 0) return message;

  const recent = history.slice(-4);
  const lastUser = [...recent].reverse().find((t) => t.role === "user")?.text || "";
  const fallback = lastUser ? `${lastUser}\n${message}` : message;

  const isLiveKey = Boolean(
    GEMINI_API_KEY && GEMINI_API_KEY.trim().length > 10 && !GEMINI_API_KEY.includes("mock")
  );
  if (!isLiveKey) return fallback;

  const rewritePrompt = `Rewrite the traveler's latest message into ONE standalone search query that includes any places, dates, group details, or topics it refers to from the conversation. Keep the same language as the latest message. If it is already standalone or changes topic, return it unchanged. Output only the query, nothing else.

Conversation:
${formatHistory(recent)}

Latest message: ${message}

Standalone query:`;

  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await Promise.race([
      model.generateContent(rewritePrompt),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    const text = result ? result.response.text().trim().replace(/^["']|["']$/g, "") : "";
    if (text && text.length <= 500) return text;
  } catch (err: any) {
    console.warn("[Query Rewrite Warning]:", err?.message || err);
  }
  return fallback;
}
