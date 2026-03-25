// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom" />
import { render } from "@testing-library/preact";
import { EquipIcon } from "./equip-icon";

describe("EquipIcon", () => {
  it("returns null for null equipId", () => {
    const { container } = render(<EquipIcon equipId={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("returns null for unknown equipId", () => {
    const { container } = render(<EquipIcon equipId={"unknown"} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders an SVG for valid equipId", () => {
    const { container } = render(<EquipIcon equipId="iron" />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders correct color class for iron", () => {
    const { container } = render(<EquipIcon equipId="iron" />);
    expect(container.innerHTML).toContain("text-zinc-500");
  });

  it("renders correct color class for acid", () => {
    const { container } = render(<EquipIcon equipId="acid" />);
    expect(container.innerHTML).toContain("text-lime-500");
  });
});
