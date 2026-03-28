import { safeAsync, fromThrowable } from "../../shared/errors";
import type { Result, InfraError } from "../../shared/errors";

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;
const TOKEN_BYTES = 32;
const encoder = new TextEncoder();

export function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toArrayBuffer(arr: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(arr.byteLength);
  new Uint8Array(buf).set(arr);
  return buf;
}

function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/.test(hex)) {
    throw new Error("fromHex: invalid hex string");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: toArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    HASH_BITS,
  );
}

const cryptoErr = (e: unknown): InfraError => ({ type: "CRYPTO_FAILED", cause: e });

export function hashPassword(
  password: string,
): Promise<Result<{ hash: string; salt: string }, InfraError>> {
  return safeAsync(async () => {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const bits = await deriveKey(password, salt);
    return { hash: toHex(bits), salt: toHex(salt) };
  }, cryptoErr);
}

export function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string,
): Promise<Result<boolean, InfraError>> {
  return safeAsync(async () => {
    const salt = fromHex(storedSalt);
    const bits = await deriveKey(password, salt);
    const derived = toHex(bits);
    if (derived.length !== storedHash.length) return false;
    const a = encoder.encode(derived);
    const b = encoder.encode(storedHash);
    return crypto.subtle.timingSafeEqual(toArrayBuffer(a), toArrayBuffer(b));
  }, cryptoErr);
}

export function hashToken(token: string): Promise<string> {
  return crypto.subtle.digest("SHA-256", encoder.encode(token)).then(toHex);
}

export function generateToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
}

export function generateId(): string {
  return crypto.randomUUID();
}

async function importHmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

export async function signState(state: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret, "sign");
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(state)));
  return `${state}.${toHex(sig)}`;
}

export async function verifyState(signed: string, secret: string): Promise<string | null> {
  const dot = signed.lastIndexOf(".");
  if (dot === -1) return null;
  const state = signed.slice(0, dot);
  const sigResult = fromThrowable(fromHex)(signed.slice(dot + 1));
  if (sigResult.isErr()) return null;
  const key = await importHmacKey(secret, "verify");
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    toArrayBuffer(sigResult.value),
    encoder.encode(state),
  );
  return valid ? state : null;
}
