import { test, expect } from "@playwright/test";
import { startNewGame, prepareForBattle } from "./fixtures/helpers";

test.describe("Battle Flow", () => {
  test.beforeEach(async ({ page }) => {
    await startNewGame(page, "卑劣なる死体泥棒");
  });

  test("enter pre-battle from shop", async ({ page }) => {
    await prepareForBattle(page);
    await page.getByRole("button", { name: "狂宴へ向かう" }).click();
    await expect(page.getByText("結果を見届ける")).toBeVisible();
  });

  test("battle plays through and shows footer", async ({ page }) => {
    await prepareForBattle(page);
    await page.getByRole("button", { name: "狂宴へ向かう" }).click();
    await page.getByText("結果を見届ける").click();

    // Battle screen should show fast-forward or conclude button
    await expect(page.getByText("早送り").or(page.getByText(/血を拭き取る/))).toBeVisible({
      timeout: 10000,
    });
  });

  test("complete battle and return to shop", async ({ page }) => {
    await prepareForBattle(page);
    await page.getByRole("button", { name: "狂宴へ向かう" }).click();
    await page.getByText("結果を見届ける").click();

    // Fast forward if available
    const ffButton = page.getByText("早送り");
    if (await ffButton.isVisible().catch(() => false)) {
      await ffButton.click();
    }

    // Wait for battle to finish and click conclude
    await expect(page.getByText(/血を拭き取る/)).toBeVisible({ timeout: 30000 });
    await page.getByText(/血を拭き取る/).click();

    // Should be back in shop (round 2) or result screen
    await expect(
      page
        .getByText("解剖台", { exact: true })
        .or(page.getByText("傑作の完成"))
        .or(page.getByText("異端認定")),
    ).toBeVisible({ timeout: 5000 });
  });
});
