import { validateEmail, validatePassword } from "./validation";

describe("validateEmail", () => {
  it("accepts valid email", () => {
    const result = validateEmail("user@example.com");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe("user@example.com");
  });

  it("normalizes to lowercase and trims", () => {
    const result = validateEmail("  User@Example.COM  ");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe("user@example.com");
  });

  it("rejects non-string input", () => {
    const result = validateEmail(123);
    expect(result.isErr()).toBe(true);
    if (result.isErr())
      expect((result.error as { reason: string }).reason).toBe("email_must_be_string");
  });

  it("rejects null input", () => {
    const result = validateEmail(null);
    expect(result.isErr()).toBe(true);
  });

  it("rejects malformed email", () => {
    const result = validateEmail("not-an-email");
    expect(result.isErr()).toBe(true);
    if (result.isErr())
      expect((result.error as { reason: string }).reason).toBe("invalid_email_format");
  });

  it("rejects email without domain", () => {
    const result = validateEmail("user@");
    expect(result.isErr()).toBe(true);
  });
});

describe("validatePassword", () => {
  it("accepts 8+ character password", () => {
    const result = validatePassword("12345678");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe("12345678");
  });

  it("rejects short password", () => {
    const result = validatePassword("1234567");
    expect(result.isErr()).toBe(true);
    if (result.isErr())
      expect((result.error as { reason: string }).reason).toBe("password_too_short");
  });

  it("rejects non-string input", () => {
    const result = validatePassword(42);
    expect(result.isErr()).toBe(true);
    if (result.isErr())
      expect((result.error as { reason: string }).reason).toBe("password_must_be_string");
  });

  it("rejects undefined", () => {
    const result = validatePassword(undefined);
    expect(result.isErr()).toBe(true);
  });

  it("rejects password exceeding max length", () => {
    const result = validatePassword("a".repeat(129));
    expect(result.isErr()).toBe(true);
    if (result.isErr())
      expect((result.error as { reason: string }).reason).toBe("password_too_long");
  });

  it("accepts password at max length boundary", () => {
    const result = validatePassword("a".repeat(128));
    expect(result.isOk()).toBe(true);
  });
});
