import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
let activeDerivations = 0;
const waiting: Array<() => void> = [];
const derive = async (password: string, salt: string): Promise<Buffer> => {
  if (activeDerivations >= 4) {
    if (waiting.length >= 16)
      throw new Error("Authentication is busy. Please try again shortly.");
    await new Promise<void>((resolve) => waiting.push(resolve));
  } else activeDerivations++;
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      scrypt(password, salt, 64, SCRYPT_OPTIONS, (error, key) =>
        error ? reject(error) : resolve(key),
      );
    });
  } finally {
    const next = waiting.shift();
    if (next) next();
    else activeDerivations--;
  }
};

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(24).toString("hex");
  return `scrypt-v1:${salt}:${(await derive(password, salt)).toString("hex")}`;
}

// This has the same derivation cost as a real account's password verification.
const DUMMY_HASH = `scrypt-v1:${"0".repeat(48)}:${"0".repeat(128)}`;
export async function verifyPassword(
  password: string,
  hash = DUMMY_HASH,
): Promise<boolean> {
  const [version, salt, digest] = hash.split(":");
  if (version !== "scrypt-v1" || !salt || !digest) return false;
  const actual = await derive(password, salt);
  const expected = Buffer.from(digest, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const createSessionToken = () => randomBytes(32).toString("base64url");
export const tokenDigest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const SESSION_SECONDS = 60 * 60 * 24 * 7;

export function assertRequestOrigin(
  request: Request,
  configuredOrigin?: string,
) {
  const expected = new URL(configuredOrigin || request.url).origin;
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site" || site === "same-site")
    throw new Error("Cross-origin requests are not allowed.");
  if (origin) {
    if (origin !== expected)
      throw new Error(
        "Request origin does not match this instance. Check KIMERU_APP_ORIGIN.",
      );
    return;
  }
  if (referer) {
    try {
      if (new URL(referer).origin === expected) return;
    } catch {
      /* invalid header */
    }
    throw new Error("Cross-origin requests are not allowed.");
  }
  if (site !== "same-origin")
    throw new Error("A same-origin browser request is required.");
}
