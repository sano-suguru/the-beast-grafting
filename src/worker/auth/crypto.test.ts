import {
  hashPassword,
  verifyPassword,
  generateToken,
  generateId,
  signState,
  verifyState,
  hashToken,
} from "./crypto";

describe("hashToken", () => {
  it("returns 64-char hex string (SHA-256)", async () => {
    const hash = await hashToken("test-token");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", async () => {
    const a = await hashToken("same-input");
    const b = await hashToken("same-input");
    expect(a).toBe(b);
  });

  it("different inputs produce different hashes", async () => {
    const a = await hashToken("token-a");
    const b = await hashToken("token-b");
    expect(a).not.toBe(b);
  });
});

describe("hashPassword / verifyPassword", () => {
  it("roundtrip: hash then verify returns true", async () => {
    const hashResult = await hashPassword("testPassword123");
    expect(hashResult.isOk()).toBe(true);
    if (!hashResult.isOk()) return;

    const verifyResult = await verifyPassword(
      "testPassword123",
      hashResult.value.hash,
      hashResult.value.salt,
    );
    expect(verifyResult.isOk()).toBe(true);
    if (!verifyResult.isOk()) return;
    expect(verifyResult.value).toBe(true);
  });

  it("wrong password returns false", async () => {
    const hashResult = await hashPassword("correctPassword");
    expect(hashResult.isOk()).toBe(true);
    if (!hashResult.isOk()) return;

    const verifyResult = await verifyPassword(
      "wrongPassword",
      hashResult.value.hash,
      hashResult.value.salt,
    );
    expect(verifyResult.isOk()).toBe(true);
    if (!verifyResult.isOk()) return;
    expect(verifyResult.value).toBe(false);
  });

  it("wrong salt returns false", async () => {
    const hashResult = await hashPassword("testPassword123");
    expect(hashResult.isOk()).toBe(true);
    if (!hashResult.isOk()) return;

    const fakeSalt = "00".repeat(16);
    const verifyResult = await verifyPassword("testPassword123", hashResult.value.hash, fakeSalt);
    expect(verifyResult.isOk()).toBe(true);
    if (!verifyResult.isOk()) return;
    expect(verifyResult.value).toBe(false);
  });

  it("hash produces hex strings of expected length", async () => {
    const result = await hashPassword("test");
    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    expect(result.value.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.value.salt).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("generateToken", () => {
  it("returns 64-char hex string", () => {
    const token = generateToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique tokens", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
  });
});

describe("generateId", () => {
  it("returns valid UUID", () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe("signState / verifyState", () => {
  const secret = "test-secret-key";

  it("roundtrip: sign then verify returns original state", async () => {
    const state = "abc-123";
    const signed = await signState(state, secret);
    const verified = await verifyState(signed, secret);
    expect(verified).toBe(state);
  });

  it("tampered state fails verification", async () => {
    const signed = await signState("original", secret);
    const tampered = signed.replace("original", "tampered");
    const verified = await verifyState(tampered, secret);
    expect(verified).toBeNull();
  });

  it("wrong secret fails verification", async () => {
    const signed = await signState("state", secret);
    const verified = await verifyState(signed, "wrong-secret");
    expect(verified).toBeNull();
  });

  it("malformed input (no dot) returns null", async () => {
    const verified = await verifyState("no-dot-here", secret);
    expect(verified).toBeNull();
  });

  it("invalid hex after dot returns null", async () => {
    const verified = await verifyState("state.not-valid-hex!!!", secret);
    expect(verified).toBeNull();
  });

  it("odd-length hex after dot returns null", async () => {
    const verified = await verifyState("state.abc", secret);
    expect(verified).toBeNull();
  });
});
