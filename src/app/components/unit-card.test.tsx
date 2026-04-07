// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from "@testing-library/preact";
import { UnitCard } from "./unit-card";
import { selection, blood, phase } from "../state/game-store";
import { makeUnit } from "../../engine/test-helpers";

beforeEach(() => {
  selection.value = null;
  blood.value = 10;
  phase.value = "SHOP";
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
    const unit = makeUnit({ baseAtk: 5, baseHp: 3 });
    render(<UnitCard unit={unit} type="SHOP_UNIT" index={0} />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows level for all levels", () => {
    const unit = makeUnit({ level: 1 });
    render(<UnitCard unit={unit} type="SHOP_UNIT" index={0} />);
    expect(screen.getByText("Lv1")).toBeInTheDocument();
  });

  it("shows level badge for level > 1", () => {
    const unit = makeUnit({ level: 2 });
    render(<UnitCard unit={unit} type="SHOP_UNIT" index={0} />);
    expect(screen.getByText("Lv2")).toBeInTheDocument();
  });

  it("selects unit on click", () => {
    const unit = makeUnit();
    render(<UnitCard unit={unit} type="SHOP_UNIT" index={2} />);
    fireEvent.click(screen.getByRole("button", { name: unit.name }));
    expect(selection.value).toEqual({ type: "SHOP_UNIT", index: 2, item: unit });
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

  it("shows exp bar for level 1 exp 0", () => {
    const unit = makeUnit({ level: 1, exp: 0 });
    render(<UnitCard unit={unit} type="BOARD_SLOT" index={0} />);
    expect(screen.getByLabelText("経験値0/2")).toBeInTheDocument();
  });

  it("shows exp bar for level 1 exp 1", () => {
    const unit = makeUnit({ level: 1, exp: 1 });
    render(<UnitCard unit={unit} type="BOARD_SLOT" index={0} />);
    expect(screen.getByLabelText("経験値1/2")).toBeInTheDocument();
  });

  it("shows exp bar for level 2 exp 2", () => {
    const unit = makeUnit({ level: 2, exp: 2 });
    render(<UnitCard unit={unit} type="BOARD_SLOT" index={0} />);
    expect(screen.getByText("Lv2")).toBeInTheDocument();
    expect(screen.getByLabelText("経験値0/3")).toBeInTheDocument();
  });

  it("shows no exp bar for level 3", () => {
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
    const badge = container.querySelector(".-top-1.-left-1");
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toContain("2");
  });
});
