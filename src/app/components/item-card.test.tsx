// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom" />
vi.mock("../state/card-actions", () => ({
  handleCardClick: vi.fn(),
}));

import { render, screen, fireEvent } from "@testing-library/preact";
import { ItemCard } from "./item-card";
import { selection, blood } from "../state/game-store";
import { handleCardClick } from "../state/card-actions";
import { ITEMS } from "../../shared/data/items";

beforeEach(() => {
  selection.value = null;
  blood.value = 10;
  vi.clearAllMocks();
});

describe("ItemCard", () => {
  it("renders empty slot when item is null", () => {
    const { container } = render(<ItemCard item={null} index={0} />);
    expect(container.querySelector("[class*=dashed]")).not.toBeNull(); // 空アイテムスロットは非インタラクティブ
  });

  it("renders item name", () => {
    render(<ItemCard item={ITEMS["iron_plate"]!} index={0} />);
    expect(screen.getByText("縫合された鉄板")).toBeInTheDocument();
  });

  it("calls handleCardClick on click", () => {
    const item = ITEMS["bile"]!;
    render(<ItemCard item={item} index={1} />);
    fireEvent.click(screen.getByRole("button", { name: item.name }));
    expect(handleCardClick).toHaveBeenCalledWith("SHOP_ITEM", 1, item);
  });

  it("shows cost badge for free items", () => {
    render(<ItemCard item={ITEMS["pure_blood"]!} index={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("does not show cost badge for standard 3-cost items", () => {
    render(<ItemCard item={ITEMS["iron_plate"]!} index={0} />);
    expect(screen.queryByText("3")).not.toBeInTheDocument();
  });

  it("applies cant-afford style when blood < cost", () => {
    blood.value = 1;
    const { container } = render(<ItemCard item={ITEMS["iron_plate"]!} index={0} />);
    expect(container.innerHTML).toContain("red-900");
  });
});
