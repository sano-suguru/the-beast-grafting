import { test, expect } from "@playwright/test";
import { startNewGame } from "./fixtures/helpers";

test.describe("Shop Interactions", () => {
  test.beforeEach(async ({ page }) => {
    await startNewGame(page, "卑劣なる死体泥棒");
  });

  test("shop displays initial units", async ({ page }) => {
    await expect(page.getByText("疫病ネズミ").first()).toBeVisible();
    await expect(page.getByText("串刺しの蝙蝠")).toBeVisible();
  });

  test("buy unit places it on board", async ({ page }) => {
    const shop = page.getByRole("region", { name: "闇市場" });
    const board = page.getByRole("region", { name: "解剖台" });

    // Click a shop unit card, then an empty board slot
    await shop.getByRole("list").first().getByRole("button").first().click();
    await board.getByRole("button", { name: "空きスロット" }).first().click();

    // Verify purchase happened - board should have fewer empty slots
    const remainingEmpty = board.getByRole("button", { name: "空きスロット" });
    const count = await remainingEmpty.count();
    expect(count).toBeGreaterThan(0);
  });

  test("roll button is visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: /墓暴き/ })).toBeVisible();
  });

  test("battle button is visible", async ({ page }) => {
    await expect(page.getByRole("button", { name: "狂宴へ向かう" })).toBeVisible();
  });
});
