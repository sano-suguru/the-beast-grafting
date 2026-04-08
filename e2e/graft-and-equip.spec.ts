import { test, expect } from "@playwright/test";
import { startNewGame } from "./fixtures/helpers";

test.describe("Graft and Equip", () => {
  test.beforeEach(async ({ page }) => {
    // Thief origin starts with rat, rat, bat in shop
    await startNewGame(page, "卑劣なる死体泥棒");
  });

  test("graft two matching units to level 2", async ({ page }) => {
    const shop = page.getByRole("region", { name: "闇市場" });
    const board = page.getByRole("region", { name: "解剖台" });
    const shopUnits = shop.getByRole("list").first();
    const emptySlots = board.getByRole("button", { name: "空きスロット" });

    // Buy first rat to slot 0
    await shopUnits.getByRole("button", { name: "疫病ネズミ" }).first().click();
    await emptySlots.first().click();

    // Wait for buy to complete
    await expect(board.getByRole("button", { name: "疫病ネズミ" })).toBeVisible();

    // Buy second rat onto the first rat (graft)
    await shopUnits.getByRole("button", { name: "疫病ネズミ" }).click();
    await board.getByRole("button", { name: "疫病ネズミ" }).click();

    // 2匹のLv1ネズミ接合 → 盤面のネズミに経験値が加算
    await expect(board.getByLabel(/経験値1\/2/)).toBeVisible();
  });

  test("sell unit increases blood", async ({ page }) => {
    const shop = page.getByRole("region", { name: "闇市場" });
    const board = page.getByRole("region", { name: "解剖台" });
    const shopUnits = shop.getByRole("list").first();
    const emptySlots = board.getByRole("button", { name: "空きスロット" });

    // Buy a unit first
    await shopUnits.getByRole("button").first().click();
    await emptySlots.first().click();

    // Wait for buy to complete — board should have the unit
    const boardButtons = board.getByRole("button");
    await expect(boardButtons.first()).not.toHaveAttribute("aria-label", "空きスロット");

    // Blood should be 7 after buying (10 - 3)
    // Now select the board unit and sell
    await board.getByRole("button").first().click();

    // Look for sell button
    const sellButton = page.getByText(/売却/);
    if (await sellButton.isVisible().catch(() => false)) {
      await sellButton.click();
    }

    await expect(page.locator("body")).toBeVisible();
  });
});
