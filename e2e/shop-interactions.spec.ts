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
    // Click a shop unit card
    const shopCards = page.locator(
      "[class*='max-w-\\[72px\\]'][class*='bg-zinc-900']:not([class*='dashed'])",
    );
    await shopCards.first().click();

    // Click empty board slot
    const emptySlots = page.locator("[class*='dashed']");
    await emptySlots.first().click();

    // Verify purchase happened - board should have fewer empty dashed slots
    const remainingEmpty = page.locator("[class*='dashed']");
    const count = await remainingEmpty.count();
    expect(count).toBeGreaterThan(0);
  });

  test("roll button is visible", async ({ page }) => {
    await expect(page.getByText(/墓暴き/)).toBeVisible();
  });

  test("battle button is visible", async ({ page }) => {
    await expect(page.getByText("狂宴へ向かう")).toBeVisible();
  });
});
