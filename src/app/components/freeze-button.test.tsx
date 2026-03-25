// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom" />
vi.mock("../state/shop-actions", () => ({
  handleFreezeClick: vi.fn(),
}));

import { render, fireEvent } from "@testing-library/preact";
import { FreezeButton } from "./freeze-button";
import { handleFreezeClick } from "../state/shop-actions";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FreezeButton", () => {
  it("shows frozen style when isFrozen is true", () => {
    const { container } = render(<FreezeButton isUnit index={0} isFrozen />);
    expect(container.innerHTML).toContain("bg-red-950");
  });

  it("shows unfrozen style when isFrozen is false", () => {
    const { container } = render(<FreezeButton isUnit index={0} isFrozen={false} />);
    expect(container.innerHTML).toContain("bg-zinc-800");
  });

  it("calls handleFreezeClick with correct args on click", () => {
    const { container } = render(<FreezeButton isUnit={false} index={2} />);
    fireEvent.click(container.querySelector("button")!);
    expect(handleFreezeClick).toHaveBeenCalledWith(false, 2);
  });
});
