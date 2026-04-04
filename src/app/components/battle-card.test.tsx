// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom" />
import { render, screen } from "@testing-library/preact";
import { BattleCard } from "./battle-card";
import { makeSnapshot } from "../../engine/test-helpers";

describe("BattleCard", () => {
  it("returns null for null unit", () => {
    const { container } = render(<BattleCard unit={null} side="p" />);
    expect(container.innerHTML).toBe("");
  });

  it("renders unit name", () => {
    const unit = makeSnapshot({ name: "テスト獣" });
    render(<BattleCard unit={unit} side="p" />);
    expect(screen.getByText("テスト獣")).toBeInTheDocument();
  });

  it("renders atk and hp", () => {
    const unit = makeSnapshot({ baseAtk: 7, baseHp: 4, atk: 7, hp: 4 });
    render(<BattleCard unit={unit} side="p" />);
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("shows floating text when actionObj has value", () => {
    const unit = makeSnapshot();
    render(<BattleCard unit={unit} side="p" actionObj={{ type: "damage", value: "-3" }} />);
    expect(screen.getByText("-3")).toBeInTheDocument();
  });

  it("does not show floating text when actionObj has no value", () => {
    const unit = makeSnapshot();
    const { container } = render(<BattleCard unit={unit} side="p" actionObj={{ type: "clash" }} />);
    expect(container.querySelector(".animate-float-up")).toBeNull();
  });

  it("applies amber name color for church unit", () => {
    const unit = makeSnapshot({ isChurch: true });
    const { container } = render(<BattleCard unit={unit} side="e" />);
    expect(container.innerHTML).toContain("text-amber-200");
  });

  it("shows hit flash on damage action", () => {
    const unit = makeSnapshot();
    const { container } = render(
      <BattleCard unit={unit} side="p" actionObj={{ type: "damage", value: "-2" }} />,
    );
    expect(container.querySelector(".animate-hit-flash")).not.toBeNull();
  });

  it("does not show hit flash for non-damage action", () => {
    const unit = makeSnapshot();
    const { container } = render(
      <BattleCard unit={unit} side="p" actionObj={{ type: "buff", value: "+1" }} />,
    );
    expect(container.querySelector(".animate-hit-flash")).toBeNull();
  });
});
