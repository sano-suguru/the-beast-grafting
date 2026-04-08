import { test, expect } from "@playwright/test";
import { startNewGame, prepareForBattle } from "./fixtures/helpers";

test.describe("Battle Flow", () => {
  test.beforeEach(async ({ page }) => {
    await startNewGame(page, "卑劣なる死体泥棒");
  });

  test("enter pre-battle from shop", async ({ page }) => {
    await prepareForBattle(page);
    await page.getByRole("button", { name: "狂宴へ向かう" }).click();
    await expect(page.getByRole("button", { name: "見届ける。" })).toBeVisible();
  });

  test("battle plays through and shows footer", async ({ page }) => {
    await prepareForBattle(page);
    await page.getByRole("button", { name: "狂宴へ向かう" }).click();
    await page.getByRole("button", { name: "見届ける。" }).click();

    // Battle screen should show fast-forward or conclude button
    await expect(
      page
        .getByRole("button", { name: "早送り" })
        .or(page.getByRole("button", { name: /死体を検分する/ })),
    ).toBeVisible({ timeout: 10000 });
  });

  test("complete battle and return to shop", async ({ page }) => {
    await prepareForBattle(page);
    await page.getByRole("button", { name: "狂宴へ向かう" }).click();
    await page.getByRole("button", { name: "見届ける。" }).click();

    // Fast forward if available
    const ffButton = page.getByRole("button", { name: "早送り" });
    if (await ffButton.isVisible().catch(() => false)) {
      await ffButton.click();
    }

    // Wait for battle to finish and click conclude
    const concludeButton = page.getByRole("button", { name: /死体を検分する/ });
    await expect(concludeButton).toBeVisible({ timeout: 30000 });
    await concludeButton.click();

    // Battle result screen — win/loss/draw, then proceed to next round or game end
    const nextButton = page.getByRole("button", { name: /次の夜へ進む|終幕を見届ける/ });
    await expect(nextButton).toBeVisible({ timeout: 5000 });
    await nextButton.click();

    // Should be back in shop (round 2) or final result screen
    await expect(
      page
        .getByRole("region", { name: "解剖台" })
        .or(page.getByRole("heading", { name: "傑作の完成" }))
        .or(page.getByRole("heading", { name: "異端認定" })),
    ).toBeVisible({ timeout: 5000 });
  });
});
