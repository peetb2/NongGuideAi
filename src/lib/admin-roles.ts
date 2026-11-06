/**
 * Pure role helpers (no DB / auth imports) so they can be used from auth.ts without circular imports.
 *
 * Emails listed in ADMIN_EMAILS (comma-separated) are always treated as admins.
 * This bootstraps the first admin; afterwards admins can promote others via the DB `role` column.
 */
export function getEnvAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isEnvAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getEnvAdminEmails().includes(email.toLowerCase());
}

export function isAdminUser(user: { email: string; role?: string | null } | null | undefined): boolean {
  if (!user) return false;
  const isEnv = isEnvAdminEmail(user.email);
  const isDefaultAdmin = user.email.toLowerCase() === "admin@matchachat.com";
  return user.role === "ADMIN" || isEnv || isDefaultAdmin;
}

