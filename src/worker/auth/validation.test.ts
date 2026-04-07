import { validateEmail, validatePassword, validateDisplayName } from "./validation";

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

describe("validateDisplayName", () => {
  it("accepts valid name", () => {
    const result = validateDisplayName("術師太郎");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe("術師太郎");
  });

  it("rejects non-string input", () => {
    const result = validateDisplayName(42);
    expect(result.isErr()).toBe(true);
    if (result.isErr())
      expect((result.error as { reason: string }).reason).toBe("name_must_be_string");
  });

  it("rejects empty string", () => {
    const result = validateDisplayName("");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect((result.error as { reason: string }).reason).toBe("name_empty");
  });

  it("rejects string of only control characters", () => {
    const result = validateDisplayName("\x00\x01\x02");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect((result.error as { reason: string }).reason).toBe("name_empty");
  });

  it("rejects name exceeding 20 characters", () => {
    const result = validateDisplayName("a".repeat(21));
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect((result.error as { reason: string }).reason).toBe("name_too_long");
  });

  it("accepts exactly 20 characters", () => {
    const result = validateDisplayName("a".repeat(20));
    expect(result.isOk()).toBe(true);
  });

  it("strips control characters from valid input", () => {
    const result = validateDisplayName("hello\x00world");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe("helloworld");
  });

  it("rejects combining characters that exceed 20 codepoints", () => {
    const result = validateDisplayName("e\u0301".repeat(11));
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect((result.error as { reason: string }).reason).toBe("name_too_long");
  });

  it("accepts emoji within length limit", () => {
    const result = validateDisplayName("\u{1F400}Player");
    expect(result.isOk()).toBe(true);
  });

  it("rejects when emoji push over 20 codepoints", () => {
    const result = validateDisplayName("\u{1F400}".repeat(21));
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect((result.error as { reason: string }).reason).toBe("name_too_long");
  });

  it("accepts 20 emoji exactly", () => {
    const result = validateDisplayName("\u{1F400}".repeat(20));
    expect(result.isOk()).toBe(true);
  });

  it("strips BiDi override characters", () => {
    const result = validateDisplayName("hello\u202Eworld");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe("helloworld");
  });

  it("strips all BiDi control characters", () => {
    const result = validateDisplayName("a\u200Eb\u202Ac\u2066d\u061Ce\uFEFFf");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe("abcdef");
  });

  it("rejects whitespace-only string", () => {
    const result = validateDisplayName("   ");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect((result.error as { reason: string }).reason).toBe("name_empty");
  });

  it("trims surrounding whitespace", () => {
    const result = validateDisplayName("  Alice  ");
    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value).toBe("Alice");
  });
});
