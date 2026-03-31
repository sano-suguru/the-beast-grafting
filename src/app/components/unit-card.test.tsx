// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom" />
vi.mock("../state/card-actions", () => ({
  handleCardClick: vi.fn(),
}));

import { render, screen, fireEvent } from "@testing-library/preact";
import { UnitCard } from "./unit-card";
import { selection, blood } from "../state/game-store";
import { handleCardClick } from "../state/card-actions";
import { makeUnit } from "../../engine/test-helpers";

beforeEach(() => {
  selection.value = null;
  blood.value = 10;
  vi.clearAllMocks();
});

describe("UnitCard", () => {
  it("renders empty slot when unit is null", () => {
    render(<UnitCard unit={null} type="BOARD_SLOT" index={0} />);
    expect(screen.getByRole("button", { name: "空きスロット" })).toBeInTheDocument();
  });

  it("renders unit name", () => {
    const unit = makeUnit({ name: "テストユニット" });
    render(<UnitCard unit={unit} type="SHOP_UNIT" index={0} />);
    expect(screen.getByText("テストユニット")).toBeInTheDocument();
  });

  it("renders atk and hp values", () => {
    const unit = makeUnit({ atk: 5, hp: 3 });
    render(<UnitCard unit={unit} type="SHOP_UNIT" index={0} />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows level badge for level > 1", () => {
    const unit = makeUnit({ level: 2 });
    render(<UnitCard unit={unit} type="SHOP_UNIT" index={0} />);
    expect(screen.getByText("Lv2")).toBeInTheDocument();
  });

  it("does not show level badge for level 1", () => {
    const unit = makeUnit({ level: 1 });
    render(<UnitCard unit={unit} type="SHOP_UNIT" index={0} />);
    expect(screen.queryByText("Lv1")).not.toBeInTheDocument();
  });

  it("calls handleCardClick on click", () => {
    const unit = makeUnit();
    render(<UnitCard unit={unit} type="SHOP_UNIT" index={2} />);
    fireEvent.click(screen.getByRole("button", { name: unit.name }));
    expect(handleCardClick).toHaveBeenCalledWith("SHOP_UNIT", 2, unit);
  });

  it("applies cant-afford style when blood < 3 for shop unit", () => {
    blood.value = 2;
    const unit = makeUnit();
    const { container } = render(<UnitCard unit={unit} type="SHOP_UNIT" index={0} />);
    expect(container.innerHTML).toContain("red-900");
  });

  it("uses costOverride for affordability check", () => {
    blood.value = 2;
    const unit = makeUnit();
    const { container } = render(
      <UnitCard unit={unit} type="SHOP_UNIT" index={0} costOverride={2} />,
    );
    expect(container.innerHTML).not.toContain("red-900");
  });

  it("shows two empty dots for level 1 exp 0", () => {
    const unit = makeUnit({ level: 1, exp: 0 });
    render(<UnitCard unit={unit} type="BOARD_SLOT" index={0} />);
    expect(screen.getByLabelText("経験値0/2")).toBeInTheDocument();
    expect(screen.getByLabelText("経験値0/2").textContent).toBe("○○");
  });

  it("shows one filled dot for level 1 exp 1", () => {
    const unit = makeUnit({ level: 1, exp: 1 });
    render(<UnitCard unit={unit} type="BOARD_SLOT" index={0} />);
    expect(screen.getByLabelText("経験値1/2").textContent).toBe("●○");
  });

  it("shows Lv2 with empty dots for level 2 exp 2", () => {
    const unit = makeUnit({ level: 2, exp: 2 });
    render(<UnitCard unit={unit} type="BOARD_SLOT" index={0} />);
    expect(screen.getByText("Lv2")).toBeInTheDocument();
    expect(screen.getByLabelText("経験値0/2").textContent).toBe("○○");
  });

  it("shows no dots for level 3", () => {
    const unit = makeUnit({ level: 3, exp: 4 });
    render(<UnitCard unit={unit} type="BOARD_SLOT" index={0} />);
    expect(screen.getByText("Lv3")).toBeInTheDocument();
    expect(screen.queryByLabelText(/経験値/)).not.toBeInTheDocument();
  });

  it("shows cost badge when costOverride differs from default", () => {
    const unit = makeUnit();
    const { container } = render(
      <UnitCard unit={unit} type="SHOP_UNIT" index={0} costOverride={2} />,
    );
    const badge = container.querySelector(".-top-1.-right-1");
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toContain("2");
  });
});
