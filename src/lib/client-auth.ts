export interface UserSessionData {
  id: string;
  email: string;
  creditBalance: number;
  role?: string;
  isActive?: boolean;
  isAdmin?: boolean;
}

const STORAGE_KEY = "matcha_user";

export function getCachedUser(): UserSessionData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearWorkspaceClientCache(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("chaming_bots_data");
    localStorage.removeItem("botwise_api_keys_store");
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        (k.startsWith("chaming_bots_data") || k.startsWith("botwise_api_keys_store"))
      ) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch {
    // Ignore
  }
}

export function setCachedUser(user: UserSessionData): void {
  if (typeof window === "undefined") return;
  try {
    const prev = getCachedUser();
    if (!prev || prev.id !== user.id) {
      clearWorkspaceClientCache();
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    window.dispatchEvent(new Event("matcha_auth_change"));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearCachedUser(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    clearWorkspaceClientCache();
    window.dispatchEvent(new Event("matcha_auth_change"));
  } catch {
    // Ignore
  }
}

export async function fetchCurrentUser(): Promise<UserSessionData | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data?.authenticated && data.user) {
        setCachedUser(data.user);
        return data.user;
      }
    }
    clearCachedUser();
    return null;
  } catch {
    return getCachedUser();
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Continue cleanup even if network fails
  } finally {
    clearCachedUser();
  }
}
