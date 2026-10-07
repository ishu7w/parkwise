import {
  randomBytes,
  scrypt as callbackScrypt,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(callbackScrypt);
const legacyScrypt = { N: 32768, r: 8, p: 2, maxmem: 64 * 1024 * 1024 };
const scryptOptions = { N: 65536, r: 8, p: 2, maxmem: 128 * 1024 * 1024 };
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const fail = (status, message) => {
  throw new HttpError(status, message);
};
export function text(value, label, min = 1, max = 120) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    fail(400, `${label} must contain ${min}–${max} characters.`);
  return value.trim();
}
export function integer(value, label, min, max) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max)
    fail(400, `${label} must be between ${min} and ${max}.`);
  return n;
}
export function coordinate(value, label, min, max) {
  if (value === "" || value === null || value === undefined)
    fail(400, `Enter ${label}.`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max)
    fail(400, `Enter valid ${label}.`);
  return n;
}
export const hashToken = (token) =>
  createHash("sha256").update(token).digest("hex");
export async function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  return `s2:${salt}:${(await scrypt(password, salt, 64, scryptOptions)).toString("hex")}`;
}
export async function passwordMatches(password, encoded) {
  const modern = encoded.startsWith("s2:");
  const [salt, key] = (modern ? encoded.slice(3) : encoded).split(":");
  if (!/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(key))
    return false;
  const actual = await scrypt(
    modern ? password : password.trim(),
    salt,
    64,
    modern ? scryptOptions : legacyScrypt,
  );
  const expected = Buffer.from(key, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function sessionCookie(token, maxAge = 604800) {
  return `parkwise_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.VERCEL || process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
export function tokenFromRequest(req) {
  const cookie = req.headers.cookie || "";
  return (
    cookie
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("parkwise_session="))
      ?.slice(17) || ""
  );
}
export async function authenticate(db, req) {
  const token = tokenFromRequest(req);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const { rows } = await db.query(
    "SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=$1 AND s.expires_at>now()",
    [hashToken(token)],
  );
  return rows[0] || null;
}
export function requireRole(user, role) {
  if (!user) fail(401, "Sign in to continue.");
  if (role && user.role !== role)
    fail(403, "This action is not available for your account.");
}
export async function startSession(db, userId, res) {
  const token = randomBytes(32).toString("hex");
  await db.query(
    "INSERT INTO sessions(token,user_id,expires_at) VALUES($1,$2,$3)",
    [
      hashToken(token),
      userId,
      new Date(Date.now() + 7 * 86400000).toISOString(),
    ],
  );
  res.setHeader("Set-Cookie", sessionCookie(token));
}
export async function throttle(db, req, email) {
  const ip = (
    req.headers["x-forwarded-for"] ||
    req.socket?.remoteAddress ||
    "local"
  )
    .split(",")[0]
    .trim();
  for (const [key, limit] of [
    [hashToken("ip:" + ip), 60],
    [hashToken("email:" + email), 20],
  ]) {
    const { rows } = await db.query(
      `INSERT INTO auth_attempts(key,count,reset_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN auth_attempts.reset_at<now() THEN 1 ELSE auth_attempts.count+1 END,reset_at=CASE WHEN auth_attempts.reset_at<now() THEN now()+interval '15 minutes' ELSE auth_attempts.reset_at END RETURNING count`,
      [key],
    );
    if (rows[0].count > limit)
      fail(429, "Too many sign-in attempts. Try again in 15 minutes.");
  }
}
export function passwordValue(value) {
  if (typeof value !== "string" || value.length < 10 || value.length > 128)
    fail(400, "Password must contain 10–128 characters.");
  return value;
}
export function checkOrigin(req) {
  if (req.headers["sec-fetch-site"] === "cross-site")
    fail(403, "Request origin is not allowed.");
  const origin = req.headers.origin;
  if (!origin) {
    if (process.env.VERCEL) fail(403, "Request origin is required.");
    return;
  }
  const host = req.headers.host;
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    fail(403, "Request origin is not allowed.");
  }
  if (parsed.host !== host || !["https:", "http:"].includes(parsed.protocol))
    fail(403, "Request origin is not allowed.");
}
export async function mutationLimit(db, req, user) {
  const identity =
    user?.id ||
    String(
      req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "local",
    )
      .split(",")[0]
      .trim();
  const { rows } = await db.query(
    "INSERT INTO auth_attempts(key,count,reset_at) VALUES($1,1,now()+interval '1 minute') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN auth_attempts.reset_at<now() THEN 1 ELSE auth_attempts.count+1 END,reset_at=CASE WHEN auth_attempts.reset_at<now() THEN now()+interval '1 minute' ELSE auth_attempts.reset_at END RETURNING count",
    [hashToken("mutation:" + identity)],
  );
  if (rows[0].count > 120)
    fail(429, "Too many changes. Please wait a minute and try again.");
}
