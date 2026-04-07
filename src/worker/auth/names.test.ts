import { generateGuestName } from "./names";
import { GUEST_NAME_PREFIX } from "../../shared/guest-name";

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
