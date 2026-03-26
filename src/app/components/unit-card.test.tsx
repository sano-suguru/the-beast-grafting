// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom" />
vi.mock("../state/card-actions", () => ({
  handleCardClick: vi.fn(),
}));

import { render, screen, fireEvent } from "@testing-library/preact";
import { UnitCard } from "./unit-card";
import { selection, blood } from "../state/game-store";
import { handleCardClick } from "../state/card-actions";
import { makeUnit } from "../engine/test-helpers";

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
});
