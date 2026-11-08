import {
  deleteCookie,
  getCookie,
  getRequest,
  setCookie,
  setResponseHeader,
} from "@tanstack/react-start/server";
import { assertRequestOrigin, SESSION_SECONDS } from "./auth.ts";
import { getRepository } from "./store.ts";

const secureCookies = () =>
  process.env.KIMERU_SECURE_COOKIES === "true" ||
  getRequest().url.startsWith("https:") ||
  process.env.KIMERU_APP_ORIGIN?.startsWith("https:") === true;
const cookieName = () =>
  secureCookies() ? "__Host-kimeru_session" : "kimeru_session";
const cookieOptions = () => ({
  httpOnly: true,
  secure: secureCookies(),
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_SECONDS,
});

export function noStore() {
  setResponseHeader("Cache-Control", "no-store");
  setResponseHeader("CDN-Cache-Control", "no-store");
}
export function currentUser() {
  noStore();
  return getRepository().userForSession(getCookie(cookieName()));
}
export function requireUser() {
  const user = currentUser();
  if (!user) throw new Error("Please sign in to continue.");
  return user;
}
export function requireAdmin() {
  return getRepository().requireAdmin(requireUser().id);
}
export function issueSession(userId: string) {
  getRepository().revokeSession(getCookie(cookieName()));
  setCookie(
    cookieName(),
    getRepository().createSession(userId),
    cookieOptions(),
  );
  noStore();
}
export function destroySession() {
  getRepository().revokeSession(getCookie(cookieName()));
  deleteCookie(cookieName(), cookieOptions());
  noStore();
}

export function assertSameOrigin() {
  noStore();
  assertRequestOrigin(getRequest(), process.env.KIMERU_APP_ORIGIN);
}

export function limitAuthentication(email: string, operation: string) {
  const repository = getRepository();
  repository.consumeLimit(
    `${operation}:email:${email.toLowerCase()}`,
    10,
    10 * 60 * 1000,
  );
  repository.consumeLimit(`${operation}:instance`, 100, 60 * 1000);
}
