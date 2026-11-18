import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function withServerlessPoolParams(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  // Do not mutate Prisma Accelerate URLs
  if (trimmed.startsWith("prisma://") || trimmed.startsWith("prisma+postgres://")) {
    return trimmed;
  }

  // Ensure runtime connections to Prisma Postgres always use the pooled endpoint
  let result = trimmed.replace("@db.prisma.io:", "@pooled.db.prisma.io:");
  const hasQuery = result.includes("?");

  if (!/[?&]connection_limit=/i.test(result)) {
    result += `${hasQuery ? "&" : "?"}connection_limit=1`;
  }

  if (result.includes("pooled.") && !/[?&]pgbouncer=/i.test(result)) {
    result += "&pgbouncer=true";
  }

  return result;
}

function resolveDatabaseUrl(): string | undefined {
  const candidates = [
    process.env.DATABASE_URL_POOLED,
    process.env.PRISMA_DATABASE_URL,
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
  ].filter((u): u is string => Boolean(u && u.trim().length > 0));

  const remoteCandidate = candidates.find(
    (u) => !u.includes("localhost") && !u.startsWith("file:")
  );

  const selected = remoteCandidate || candidates[0];
  if (!selected) return undefined;

  return withServerlessPoolParams(selected);
}

const resolvedUrl = resolveDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(resolvedUrl ? { datasources: { db: { url: resolvedUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;

export default prisma;
