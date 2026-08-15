/**
 * Platform admin = product owner only.
 * Hardcoded owner + optional ADMIN_EMAILS env (comma-separated).
 */
const HARDCODED_ADMIN_EMAILS = ["yichengcai509@gmail.com"];

export function getAdminEmails() {
  const fromEnv = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const set = new Set([
    ...HARDCODED_ADMIN_EMAILS.map((e) => e.toLowerCase()),
    ...fromEnv,
  ]);
  return [...set];
}

export function isPlatformAdmin(session) {
  const email = session?.user?.email;
  if (!email) return false;
  return getAdminEmails().includes(String(email).trim().toLowerCase());
}
