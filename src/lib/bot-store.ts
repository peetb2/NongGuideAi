import { getCachedUser } from "./client-auth";

export interface BotItem {
  id: string;
  name: string;
  desc: string;
  model: string;
  lastActive: string;
  status: "active" | "paused";
  knowledgeCount?: number;
  usageCount?: number;
  systemPrompt?: string;
  websiteUrl?: string | null;
  lastCrawledAt?: string | null;
}

export const INITIAL_BOTS: BotItem[] = [];

const STORAGE_KEY_PREFIX = "chaming_bots_data";

function getScopedStorageKey(): string | null {
  const user = getCachedUser();
  if (!user?.id) return null;
  return `${STORAGE_KEY_PREFIX}_${user.id}`;
}

export function getStoredBots(): BotItem[] {
  if (typeof window === "undefined") {
    return INITIAL_BOTS;
  }
  try {
    const scopedKey = getScopedStorageKey();
    if (!scopedKey) return INITIAL_BOTS;
    const raw = localStorage.getItem(scopedKey);
    if (!raw) {
      return INITIAL_BOTS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.error("Failed to load bots from localStorage:", err);
  }
  return INITIAL_BOTS;
}

export function saveStoredBots(bots: BotItem[]): void {
  if (typeof window === "undefined") return;
  try {
    const scopedKey = getScopedStorageKey();
    if (!scopedKey) return;
    localStorage.setItem(scopedKey, JSON.stringify(bots));
  } catch (err) {
    console.error("Failed to save bots to localStorage:", err);
  }
}

export function addStoredBot(bot: BotItem): BotItem[] {
  const current = getStoredBots();
  const updated = [bot, ...current];
  saveStoredBots(updated);
  return updated;
}
