import { getCachedUser } from "./client-auth";

export interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  created: string;
  lastUsed: string;
  perm: string;
  botId?: string;
  botName?: string;
  rawKey?: string;
}

export const INITIAL_API_KEYS: ApiKeyItem[] = [];

const STORAGE_KEY_PREFIX = "botwise_api_keys_store";

function getScopedStorageKey(): string | null {
  const user = getCachedUser();
  if (!user?.id) return null;
  return `${STORAGE_KEY_PREFIX}_${user.id}`;
}

export function getStoredApiKeys(): ApiKeyItem[] {
  if (typeof window === "undefined") {
    return INITIAL_API_KEYS;
  }
  try {
    const scopedKey = getScopedStorageKey();
    if (!scopedKey) return INITIAL_API_KEYS;
    const raw = localStorage.getItem(scopedKey);
    if (!raw) {
      return INITIAL_API_KEYS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.error("Failed to load API keys from localStorage:", err);
  }
  return INITIAL_API_KEYS;
}

export function saveStoredApiKeys(keys: ApiKeyItem[]): void {
  if (typeof window === "undefined") return;
  try {
    const scopedKey = getScopedStorageKey();
    if (!scopedKey) return;
    localStorage.setItem(scopedKey, JSON.stringify(keys));
  } catch (err) {
    console.error("Failed to save API keys to localStorage:", err);
  }
}

export function addStoredApiKey(key: ApiKeyItem): ApiKeyItem[] {
  const current = getStoredApiKeys();
  const updated = [key, ...current];
  saveStoredApiKeys(updated);
  return updated;
}

export function removeStoredApiKey(keyId: string): ApiKeyItem[] {
  const current = getStoredApiKeys();
  const updated = current.filter((k) => k.id !== keyId);
  saveStoredApiKeys(updated);
  return updated;
}
