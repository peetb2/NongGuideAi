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
  errorCode?: "INVALID_KEY" | "BOT_INACTIVE" | "INSUFFICIENT_CREDITS" | "DOMAIN_NOT_ALLOWED";
  errorMessage?: string;
  apiKey?: any;
  bot?: any;
  user?: any;
}

/**
 * SHA-256 Hashing helper for raw API keys.
 * Ensures consistent key hashing across registration, verification, and database storage.
 */
export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey.trim()).digest("hex");
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
export function isDomainAllowed(allowedDomains: string[] | string, originDomain?: string): boolean {
  const domains: string[] = Array.isArray(allowedDomains)
    ? allowedDomains
    : typeof allowedDomains === "string"
    ? allowedDomains.split(",").map((s) => s.trim())
    : ["*"];

  if (!domains || domains.length === 0 || domains.includes("*")) {
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
  const cleanKey = (rawKey || "").trim();

  let apiKeyRecord: any = null;

  // 1. Try exact keyHash lookup (for full API keys)
  if (cleanKey) {
    const keyHash = hashApiKey(cleanKey);
    apiKeyRecord = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        bot: true,
        user: true,
      },
    });

    // 2. If not found by hash, try finding by keyPrefix (e.g. preview from dashboard)
    if (!apiKeyRecord && (cleanKey.startsWith("pk_") || cleanKey.startsWith("sk_"))) {
      apiKeyRecord = await prisma.apiKey.findFirst({
        where: { keyPrefix: cleanKey },
        include: {
          bot: true,
          user: true,
        },
      });
    }
  }

  // 3. Fallback for dashboard live preview: only when an explicit botId is provided
  if (!apiKeyRecord && options?.botId && (cleanKey === "pk_live_preview_demo" || cleanKey.includes("preview"))) {
    const bot = await prisma.bot.findUnique({
      where: { id: options.botId },
      include: { user: true, apiKeys: true },
    });

    if (bot && bot.apiKeys && bot.apiKeys.length > 0) {
      const existingKey = bot.apiKeys[0];
      apiKeyRecord = {
        id: existingKey.id,
        botId: bot.id,
        userId: bot.userId,
        keyPrefix: existingKey.keyPrefix,
        keyHash: existingKey.keyHash,
        type: existingKey.type,
        rateLimitPerMinute: existingKey.rateLimitPerMinute,
        createdAt: existingKey.createdAt,
        bot: bot,
        user: bot.user,
      };
    }
  }

  if (!apiKeyRecord) {
    return {
      valid: false,
      errorCode: "INVALID_KEY",
      errorMessage: "Invalid API key",
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
