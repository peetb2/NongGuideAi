import crypto from "crypto";
import { prisma } from "./prisma";
export type KeyType = "PUBLIC_WIDGET" | "SECRET_SERVER";
export const KeyType = {
  PUBLIC_WIDGET: "PUBLIC_WIDGET" as KeyType,
  SECRET_SERVER: "SECRET_SERVER" as KeyType,
};

export interface GeneratedKeyResult {
  rawKey: string;     // Full unhashed raw key (shown to user only ONCE upon creation)
  keyPrefix: string;  // Redacted preview format (e.g., "pk_live_ab12345")
  keyHash: string;    // SHA-256 hash stored in the database
  type: KeyType;
}

export interface KeyVerificationResult {
  valid: boolean;
  errorCode?:
    | "MISSING_KEY"
    | "INVALID_KEY"
    | "BOT_INACTIVE"
    | "INSUFFICIENT_CREDITS"
    | "DOMAIN_NOT_ALLOWED";
  errorMessage?: string;
  apiKey?: any;
  bot?: any;
  user?: any;
}

/**
 * Normalizes and trims an incoming API key string (strips Bearer prefix and quotes).
 */
export function cleanIncomingKey(rawKey: string | null | undefined): string {
  if (!rawKey) return "";
  return rawKey
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

/**
 * SHA-256 Hashing helper for raw API keys.
 * Ensures consistent key hashing across registration, verification, and database storage.
 */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(cleanIncomingKey(rawKey)).digest("hex");
}

/**
 * Key Generator using node's crypto.randomBytes.
 * Generates prefixed keys ('pk_live_...' for PUBLIC_WIDGET and 'sk_live_...' for SECRET_SERVER)
 * and returns the raw key, its display prefix, and SHA-256 hash.
 */
export function generateApiKey(type: KeyType = KeyType.PUBLIC_WIDGET): GeneratedKeyResult {
  const prefix = type === KeyType.PUBLIC_WIDGET ? "pk_live_" : "sk_live_";
  const randomBytesHex = crypto.randomBytes(24).toString("hex"); // 48 chars hex
  
  const rawKey = `${prefix}${randomBytesHex}`;
  const keyPrefix = `${prefix}${randomBytesHex.substring(0, 7)}`;
  const keyHash = hashApiKey(rawKey);

  return {
    rawKey,
    keyPrefix,
    keyHash,
    type,
  };
}

/**
 * Helper to normalize domain strings for CORS checking (e.g. removes protocol & port if needed)
 */
export function normalizeDomain(domain: string): string {
  try {
    const url = new URL(domain.includes("://") ? domain : `https://${domain}`);
    return url.hostname.toLowerCase();
  } catch {
    return domain.trim().toLowerCase();
  }
}

/**
 * Verification helper that hashes an incoming raw key and matches it against the database.
 * Validates key existence, bot active status, domain whitelist (CORS), and user credit balance.
 */
export function isDomainAllowed(allowedDomains: string[] | string | null | undefined, originDomain?: string): boolean {
  const domains: string[] = (
    Array.isArray(allowedDomains)
      ? allowedDomains
      : typeof allowedDomains === "string"
      ? allowedDomains.split(",")
      : ["*"]
  )
    .map((s) => s.trim())
    .filter(Boolean);

  if (domains.length === 0 || domains.includes("*")) {
    return true; // Empty array or wildcard allows all origins
  }

  if (!originDomain) {
    return false;
  }

  const normalizedOrigin = normalizeDomain(originDomain);

  // Always allow local development and dashboard preview
  if (
    normalizedOrigin === "localhost" ||
    normalizedOrigin.startsWith("localhost:") ||
    normalizedOrigin === "127.0.0.1" ||
    normalizedOrigin.startsWith("127.0.0.1:")
  ) {
    return true;
  }
  
  return domains.some((domain) => {
    const normalizedAllowed = normalizeDomain(domain);
    if (normalizedAllowed === "*") return true;
    if (normalizedAllowed.startsWith("*.")) {
      const rootDomain = normalizedAllowed.slice(2);
      return normalizedOrigin === rootDomain || normalizedOrigin.endsWith(`.${rootDomain}`);
    }
    return normalizedOrigin === normalizedAllowed;
  });
}

export async function verifyApiKey(
  rawKey: string,
  options?: { originDomain?: string; botId?: string }
): Promise<KeyVerificationResult> {
  const cleanKey = cleanIncomingKey(rawKey);
  const cleanBotId = (options?.botId || "").trim();
  const isPlaceholderKey =
    !cleanKey ||
    cleanKey === "pk_live_YOUR_API_KEY" ||
    cleanKey === "pk_live_preview_demo" ||
    cleanKey.includes("YOUR_API_KEY");

  if (!cleanKey && !cleanBotId) {
    return {
      valid: false,
      errorCode: "MISSING_KEY",
      errorMessage: "API key is missing. Please provide a valid data-bot-key in your widget script.",
    };
  }

  let apiKeyRecord: any = null;

  // 1. Try exact keyHash lookup (for full API keys)
  if (cleanKey && !isPlaceholderKey) {
    const keyHash = hashApiKey(cleanKey);
    apiKeyRecord = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        bot: true,
        user: true,
      },
    });

    // 2. If not found by hash, try finding by exact keyPrefix (e.g. snippet copied from Widget Customizer)
    if (!apiKeyRecord && (cleanKey.startsWith("pk_") || cleanKey.startsWith("sk_"))) {
      apiKeyRecord = await prisma.apiKey.findFirst({
        where: {
          keyPrefix: cleanKey,
          ...(cleanBotId ? { botId: cleanBotId } : {}),
        },
        include: {
          bot: true,
          user: true,
        },
      });
    }

    // 3. If cleanKey is longer than 15 chars, also try matching its 15-char prefix (pk_live_ + 7 hex chars)
    if (!apiKeyRecord && (cleanKey.startsWith("pk_live_") || cleanKey.startsWith("sk_live_")) && cleanKey.length >= 15) {
      const prefix15 = cleanKey.slice(0, 15);
      apiKeyRecord = await prisma.apiKey.findFirst({
        where: {
          keyPrefix: prefix15,
          ...(cleanBotId ? { botId: cleanBotId } : {}),
        },
        include: {
          bot: true,
          user: true,
        },
      });
    }
  }

  // 4. Fallback when an explicit botId is provided (e.g. dashboard preview or widget snippet with data-bot="<botId>")
  if (!apiKeyRecord && cleanBotId) {
    const bot = await prisma.bot.findUnique({
      where: { id: cleanBotId },
      include: { user: true, apiKeys: true },
    });

    if (bot) {
      let existingKey = bot.apiKeys && bot.apiKeys.length > 0 ? bot.apiKeys[0] : null;
      // If this bot had no API key in the database yet, auto-create a PUBLIC_WIDGET key for it
      if (!existingKey) {
        const generated = generateApiKey(KeyType.PUBLIC_WIDGET);
        existingKey = await prisma.apiKey.create({
          data: {
            botId: bot.id,
            userId: bot.userId,
            keyPrefix: generated.keyPrefix,
            keyHash: generated.keyHash,
            type: KeyType.PUBLIC_WIDGET,
            rateLimitPerMinute: 60,
          },
        });
      }
      apiKeyRecord = {
        ...existingKey,
        bot: bot,
        user: bot.user,
      };
    }
  }

  if (!apiKeyRecord) {
    return {
      valid: false,
      errorCode: isPlaceholderKey ? "MISSING_KEY" : "INVALID_KEY",
      errorMessage: isPlaceholderKey
        ? "API key is missing or still set to placeholder 'pk_live_YOUR_API_KEY'. Please copy the full embed script from your NongGuide AI dashboard."
        : "Invalid API key. Please verify your data-bot-key or generate a new API key in your NongGuide AI dashboard.",
    };
  }

  // Check if Bot is active
  if (!apiKeyRecord.bot || !apiKeyRecord.bot.isActive) {
    return {
      valid: false,
      errorCode: "BOT_INACTIVE",
      errorMessage: "The chatbot associated with this API key is inactive or disabled",
      apiKey: apiKeyRecord,
      bot: apiKeyRecord.bot,
      user: apiKeyRecord.user,
    };
  }

  // Check User Credit Balance
  if (apiKeyRecord.user.creditBalance <= 0) {
    return {
      valid: false,
      errorCode: "INSUFFICIENT_CREDITS",
      errorMessage: "Account has run out of credits. Please top up your balance.",
      apiKey: apiKeyRecord,
      bot: apiKeyRecord.bot,
      user: apiKeyRecord.user,
    };
  }

  // Check CORS Whitelisted Domains if origin is specified or required for PUBLIC_WIDGET
  if (apiKeyRecord.type === KeyType.PUBLIC_WIDGET && options?.originDomain) {
    const isAllowed = isDomainAllowed(apiKeyRecord.bot.allowedDomains, options.originDomain);
    if (!isAllowed) {
      return {
        valid: false,
        errorCode: "DOMAIN_NOT_ALLOWED",
        errorMessage: `Origin domain '${options.originDomain}' is not whitelisted for this chatbot key`,
        apiKey: apiKeyRecord,
        bot: apiKeyRecord.bot,
        user: apiKeyRecord.user,
      };
    }
  }

  return {
    valid: true,
    apiKey: apiKeyRecord,
    bot: apiKeyRecord.bot,
    user: apiKeyRecord.user,
  };
}
