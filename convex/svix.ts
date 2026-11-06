/**
 * AgentMail (Svix-style) webhook signature check (CHR-1474).
 *
 * Inbox creation at agentmail.to is a human/credentials step and is not
 * done here. This module only verifies the signed raw body so emailed
 * submissions can land as pending once Chris points a webhook at
 * /agentmail/inbound.
 */

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export interface SvixHeaderSource {
  get(name: string): string | null;
}

const MAX_SKEW_SEC = 300;

export async function verifySvix(
  rawBody: string,
  headers: SvixHeaderSource,
  secret: string,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const ts = parseInt(svixTimestamp, 10);
  if (Number.isNaN(ts)) return false;
  if (Math.abs(nowSec - ts) > MAX_SKEW_SEC) return false;

  const b64 = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const keyBytes = new Uint8Array(b64.length);
  try {
    const bin = atob(b64);
    for (let i = 0; i < bin.length; i++) keyBytes[i] = bin.charCodeAt(i);
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${svixId}.${svixTimestamp}.${rawBody}`),
  );
  const macBytes = new Uint8Array(mac);
  let computed = "";
  for (let i = 0; i < macBytes.length; i++) {
    computed += String.fromCharCode(macBytes[i]);
  }
  computed = btoa(computed);

  return svixSignature
    .split(" ")
    .map((part) => (part.startsWith("v1,") ? part.slice(3) : part))
    .some((sig) => timingSafeEqual(sig, computed));
}

export async function signSvix(
  rawBody: string,
  svixId: string,
  svixTimestamp: string,
  secret: string,
): Promise<string> {
  const b64 = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const bin = atob(b64);
  const keyBytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) keyBytes[i] = bin.charCodeAt(i);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${svixId}.${svixTimestamp}.${rawBody}`),
  );
  const macBytes = new Uint8Array(mac);
  let computed = "";
  for (let i = 0; i < macBytes.length; i++) {
    computed += String.fromCharCode(macBytes[i]);
  }
  return `v1,${btoa(computed)}`;
}
