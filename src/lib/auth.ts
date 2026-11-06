import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma";
import { isAdminUser } from "./admin-roles";

const SECRET_KEY = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || "matchachatbot-secret-key-change-in-production-min-32"
);

export interface AuthSession {
  userId: string;
  email: string;
}

export async function createSessionToken(payload: AuthSession): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET_KEY);
}

export async function verifySessionToken(token: string): Promise<AuthSession | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
    };
  } catch (error) {
    return null;
  }
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const cookieStore = cookies();
  const token = cookieStore.get("matcha_session")?.value;
  if (!token) return null;
  return await verifySessionToken(token);
}

export async function getCurrentUser() {
  const session = await getAuthSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      creditBalance: true,
      createdAt: true,
    },
  });

  if (!user) return null;

  let role = "USER";
  let isActive = true;
  try {
    const rawUsers: any = await prisma.$queryRawUnsafe(
      "SELECT role, isActive FROM users WHERE id = ? LIMIT 1",
      user.id
    );
    if (rawUsers && rawUsers.length > 0) {
      if (rawUsers[0].role) role = rawUsers[0].role;
      if (rawUsers[0].isActive !== undefined && rawUsers[0].isActive !== null) {
        isActive = Boolean(rawUsers[0].isActive);
      }
    }
  } catch {
    // fallback
  }

  const userWithRole = { ...user, role, isActive };
  const isAdmin = isAdminUser(userWithRole);

  return {
    ...userWithRole,
    isAdmin,
  };
}
