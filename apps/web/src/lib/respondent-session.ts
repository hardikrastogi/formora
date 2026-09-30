import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";

/**
 * A respondent who verified their email gets a small signed cookie, one per
 * form. It says "identity X may fill out form Y until time Z" and nothing
 * else. It is not a Formora account session and grants no dashboard access.
 *
 * Format: <identityId>.<formId>.<expiresAtMs>.<signature>, where the
 * signature is an HMAC over the first three parts. Changing any part
 * (someone else's identity id, another form's id, a later expiry) breaks it.
 */
export const RESPONDENT_SESSION_SECONDS = 2 * 60 * 60;

export function respondentCookieName(formId: string): string {
  return `fr_${formId}`;
}

// A key derived from AUTH_SECRET, so the raw secret is never used directly for two different jobs.
function key(): Buffer {
  return createHmac("sha256", getEnv().AUTH_SECRET).update("formora-respondent-session-v1").digest();
}

function sign(payload: string): string {
  return createHmac("sha256", key()).update(payload).digest("base64url");
}

export function createRespondentToken(identityId: string, formId: string, now = Date.now()): string {
  const payload = `${identityId}.${formId}.${now + RESPONDENT_SESSION_SECONDS * 1000}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the verified identity id, or null if the token is missing, forged, for another form, or expired. */
export function verifyRespondentToken(token: string | undefined, formId: string, now = Date.now()): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [identityId, tokenFormId, expires, signature] = parts;

  const expected = Buffer.from(sign(`${identityId}.${tokenFormId}.${expires}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  if (tokenFormId !== formId) return null;
  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt) || now > expiresAt) return null;
  return identityId;
}

/** Keyed hash of an IP address: enough to count requests per address without storing the address. */
export function hashIp(ip: string): string {
  return createHmac("sha256", key()).update(`ip:${ip}`).digest("base64url");
}
