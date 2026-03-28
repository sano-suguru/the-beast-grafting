import {
  generateGuestName,
  sanitizeDisplayName,
  emailLocalToDisplayName,
  GUEST_NAME_PREFIX,
} from "./names";

describe("generateGuestName", () => {
  it("returns name matching expected format", () => {
    const name = generateGuestName();
    expect(name).toMatch(new RegExp(`^${GUEST_NAME_PREFIX}[0-9A-F]{4}$`));
  });

  it("generates different names on successive calls", () => {
    const names = new Set(Array.from({ length: 10 }, () => generateGuestName()));
    expect(names.size).toBeGreaterThan(1);
  });
});

describe("sanitizeDisplayName", () => {
  it("passes through normal string", () => {
    expect(sanitizeDisplayName("Alice")).toBe("Alice");
  });

  it("passes through Japanese text", () => {
    expect(sanitizeDisplayName("術師太郎")).toBe("術師太郎");
  });

  it("strips control characters", () => {
    expect(sanitizeDisplayName("hello\x00world\x1F!")).toBe("helloworld!");
  });

  it("strips DEL and C1 control characters", () => {
    expect(sanitizeDisplayName("a\x7Fb\x80c\x9Fd")).toBe("abcd");
  });

  it("returns 'User' for empty string", () => {
    expect(sanitizeDisplayName("")).toBe("User");
  });

  it("returns 'User' for string of only control chars", () => {
    expect(sanitizeDisplayName("\x00\x01\x02")).toBe("User");
  });

  it("truncates to 20 characters", () => {
    const long = "a".repeat(25);
    expect(sanitizeDisplayName(long)).toBe("a".repeat(20));
  });

  it("truncates by codepoint, not byte", () => {
    const emoji20 = "🎮".repeat(20);
    const result = sanitizeDisplayName(emoji20);
    expect(Array.from(result).length).toBe(20);
  });

  it("preserves exactly 20-char input", () => {
    const exact = "a".repeat(20);
    expect(sanitizeDisplayName(exact)).toBe(exact);
  });
});

describe("emailLocalToDisplayName", () => {
  it("extracts local part from email", () => {
    expect(emailLocalToDisplayName("alice@example.com")).toBe("alice");
  });

  it("strips + tag from local part", () => {
    expect(emailLocalToDisplayName("user+tag@example.com")).toBe("user");
  });

  it("handles trailing + with no tag", () => {
    expect(emailLocalToDisplayName("user+@example.com")).toBe("user");
  });

  it("falls back to full local part when it starts with +", () => {
    expect(emailLocalToDisplayName("+tag@example.com")).toBe("+tag");
  });
});
