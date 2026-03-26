// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom" />
vi.mock("../state/shop-actions", () => ({
  handleFreezeClick: vi.fn(),
}));

import { render, screen, fireEvent } from "@testing-library/preact";
import { FreezeButton } from "./freeze-button";
import { handleFreezeClick } from "../state/shop-actions";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FreezeButton", () => {
  it("shows frozen state when isFrozen is true", () => {
    render(<FreezeButton isUnit index={0} isFrozen />);
    const toggle = screen.getByRole("switch", { name: "凍結" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("shows unfrozen state when isFrozen is false", () => {
    render(<FreezeButton isUnit index={0} isFrozen={false} />);
    const toggle = screen.getByRole("switch", { name: "凍結" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("calls handleFreezeClick with correct args on click", () => {
    render(<FreezeButton isUnit={false} index={2} />);
    fireEvent.click(screen.getByRole("switch", { name: "凍結" }));
    expect(handleFreezeClick).toHaveBeenCalledWith(false, 2);
  });
});
