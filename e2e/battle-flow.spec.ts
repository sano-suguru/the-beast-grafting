import { test, expect } from "@playwright/test";
import { startNewGame, prepareForBattle } from "./fixtures/helpers";

test.describe("Battle Flow", () => {
  test.beforeEach(async ({ page }) => {
    await startNewGame(page, "卑劣なる死体泥棒");
  });

  test("enter pre-battle from shop", async ({ page }) => {
    await prepareForBattle(page);
    await page.getByRole("button", { name: "狂宴へ向かう" }).click();
    await expect(page.getByRole("button", { name: "結果を見届ける" })).toBeVisible();
  });

  test("battle plays through and shows footer", async ({ page }) => {
    await prepareForBattle(page);
    await page.getByRole("button", { name: "狂宴へ向かう" }).click();
    await page.getByRole("button", { name: "結果を見届ける" }).click();

    // Battle screen should show fast-forward or conclude button
    await expect(
      page
        .getByRole("button", { name: "早送り" })
        .or(page.getByRole("button", { name: /血を拭き取る/ })),
    ).toBeVisible({ timeout: 10000 });
  });

  test("complete battle and return to shop", async ({ page }) => {
    await prepareForBattle(page);
    await page.getByRole("button", { name: "狂宴へ向かう" }).click();
    await page.getByRole("button", { name: "結果を見届ける" }).click();

    // Fast forward if available
    const ffButton = page.getByRole("button", { name: "早送り" });
    if (await ffButton.isVisible().catch(() => false)) {
      await ffButton.click();
    }

    // Wait for battle to finish and click conclude
    const concludeButton = page.getByRole("button", { name: /血を拭き取る/ });
    await expect(concludeButton).toBeVisible({ timeout: 30000 });
    await concludeButton.click();

    // Should be back in shop (round 2) or result screen
    await expect(
      page
        .getByRole("region", { name: "解剖台" })
        .or(page.getByRole("heading", { name: "傑作の完成" }))
        .or(page.getByRole("heading", { name: "異端認定" })),
    ).toBeVisible({ timeout: 5000 });
  });
});
