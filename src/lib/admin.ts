import { prisma } from "./prisma";
import { getCurrentUser } from "./auth";
import { isAdminUser } from "./admin-roles";
import bcrypt from "bcryptjs";

export interface AdminUserListItem {
  id: string;
  email: string;
  role: string;
  creditBalance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  botCount: number;
  apiKeyCount: number;
  usageLogCount: number;
  bots?: {
    id: string;
    name: string;
    model: string;
    isActive: boolean;
    createdAt: string;
  }[];
  apiKeys?: {
    id: string;
    keyPrefix: string;
    type: string;
    createdAt: string;
  }[];
}

/**
 * Verify if the currently authenticated user has admin privileges.
 * Returns the currentUser if valid admin, otherwise null.
 */
export async function requireAdmin() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return null;
  if (!currentUser.isAdmin) return null;
  return currentUser;
}

/**
 * Get all users with associated bot, key, and usage counts.
 */
export async function getAdminUsersList(searchQuery?: string, roleFilter?: string): Promise<AdminUserListItem[]> {
  // Query users from SQLite
  const rawUsers: any[] = await prisma.$queryRawUnsafe(
    "SELECT id, email, passwordHash, creditBalance, role, isActive, createdAt, updatedAt FROM users ORDER BY createdAt DESC"
  );

  // Fetch counts and related bots and apiKeys
  const bots = await prisma.bot.findMany({
    select: {
      id: true,
      userId: true,
      name: true,
      model: true,
      isActive: true,
      createdAt: true,
    },
  });

  const apiKeys = await prisma.apiKey.findMany({
    select: {
      id: true,
      userId: true,
      keyPrefix: true,
      type: true,
      createdAt: true,
    },
  });

  const usageLogs = await prisma.usageLog.groupBy({
    by: ["botId"],
    _count: {
      id: true,
    },
  });

  // Map botId -> usage count
  const botUsageMap = new Map<string, number>();
  for (const item of usageLogs) {
    botUsageMap.set(item.botId, item._count.id);
  }

  // Group bots & apiKeys by userId
  const botsByUser = new Map<string, any[]>();
  for (const b of bots) {
    const list = botsByUser.get(b.userId) || [];
    list.push(b);
    botsByUser.set(b.userId, list);
  }

  const keysByUser = new Map<string, any[]>();
  for (const k of apiKeys) {
    const list = keysByUser.get(k.userId) || [];
    list.push(k);
    keysByUser.set(k.userId, list);
  }

  let result: AdminUserListItem[] = rawUsers.map((u) => {
    const userBots = botsByUser.get(u.id) || [];
    const userKeys = keysByUser.get(u.id) || [];
    
    // Calculate total usage for this user's bots
    let totalLogs = 0;
    for (const b of userBots) {
      totalLogs += botUsageMap.get(b.id) || 0;
    }

    const role = u.role || (isAdminUser(u) ? "ADMIN" : "USER");
    const isActive = u.isActive !== undefined && u.isActive !== null ? Boolean(u.isActive) : true;

    return {
      id: u.id,
      email: u.email,
      role: role,
      creditBalance: typeof u.creditBalance === "number" ? u.creditBalance : 50,
      isActive,
      createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt),
      updatedAt: u.updatedAt instanceof Date ? u.updatedAt.toISOString() : String(u.updatedAt),
      botCount: userBots.length,
      apiKeyCount: userKeys.length,
      usageLogCount: totalLogs,
      bots: userBots.map((b) => ({
        id: b.id,
        name: b.name,
        model: b.model,
        isActive: b.isActive,
        createdAt: b.createdAt.toISOString(),
      })),
      apiKeys: userKeys.map((k) => ({
        id: k.id,
        keyPrefix: k.keyPrefix,
        type: k.type,
        createdAt: k.createdAt.toISOString(),
      })),
    };
  });

  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    result = result.filter(
      (u) => u.email.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)
    );
  }

  if (roleFilter && roleFilter !== "all") {
    result = result.filter((u) => u.role === roleFilter);
  }

  return result;
}

/**
 * Update user fields (creditBalance, role, isActive, password)
 */
export async function updateAdminUser(
  userId: string,
  data: {
    creditBalance?: number;
    creditAdjustment?: number;
    role?: "USER" | "ADMIN";
    isActive?: boolean;
    password?: string;
  }
) {
  // Check user existence
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser) {
    throw new Error("User not found");
  }

  // Handle password update if provided
  if (data.password && data.password.trim().length >= 6) {
    const passwordHash = await bcrypt.hash(data.password.trim(), 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  // Handle credits
  if (typeof data.creditBalance === "number") {
    await prisma.user.update({
      where: { id: userId },
      data: { creditBalance: Math.max(0, Math.round(data.creditBalance)) },
    });
  } else if (typeof data.creditAdjustment === "number") {
    const currentBalance = existingUser.creditBalance || 0;
    const newBalance = Math.max(0, currentBalance + Math.round(data.creditAdjustment));
    await prisma.user.update({
      where: { id: userId },
      data: { creditBalance: newBalance },
    });
  }

  // Handle role and isActive directly in SQLite
  if (data.role) {
    await prisma.$executeRawUnsafe(
      "UPDATE users SET role = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
      data.role,
      userId
    );
  }

  if (typeof data.isActive === "boolean") {
    await prisma.$executeRawUnsafe(
      "UPDATE users SET isActive = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
      data.isActive ? 1 : 0,
      userId
    );
  }

  return true;
}

/**
 * Delete a user and associated data
 */
export async function deleteAdminUser(userId: string) {
  // Prisma onDelete: Cascade is configured for bot, apiKey, usageLog, etc.
  return await prisma.user.delete({
    where: { id: userId },
  });
}

/**
 * Create a new user from Admin panel
 */
export async function createAdminUser(data: {
  email: string;
  password: string;
  creditBalance?: number;
  role?: "USER" | "ADMIN";
}) {
  const email = data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    throw new Error("Email is already registered");
  }

  const passwordHash = await bcrypt.hash(data.password.trim(), 10);
  const creditBalance = typeof data.creditBalance === "number" ? Math.max(0, data.creditBalance) : 50;

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      creditBalance,
    },
  });

  const role = data.role === "ADMIN" ? "ADMIN" : "USER";
  await prisma.$executeRawUnsafe(
    "UPDATE users SET role = ? WHERE id = ?",
    role,
    user.id
  );

  return {
    id: user.id,
    email: user.email,
    creditBalance: user.creditBalance,
    role,
    createdAt: user.createdAt,
  };
}
