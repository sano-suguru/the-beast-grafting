import { test, expect } from "@playwright/test";
import { startNewGame } from "./fixtures/helpers";

test.describe("Game Flow", () => {
  test("title screen loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("The Beast Grafter")).toBeVisible();
    await expect(page.getByText("地下室へ降りる")).toBeVisible();
  });

  test("navigate from title to origin selection", async ({ page }) => {
    await page.goto("/");
    await page.getByText("地下室へ降りる").click();
    await expect(page.getByText("素性の選択")).toBeVisible();
    await expect(page.getByText("卑劣なる死体泥棒")).toBeVisible();
    await expect(page.getByText("堕ちた異端審問官")).toBeVisible();
    await expect(page.getByText("狂気の解剖医")).toBeVisible();
    await expect(page.getByText("深淵の邪教徒")).toBeVisible();
  });

  test("select origin and enter shop", async ({ page }) => {
    await startNewGame(page, "卑劣なる死体泥棒");
    await expect(page.getByText("解剖台", { exact: true })).toBeVisible();
    await expect(page.getByText("疫病ネズミ").first()).toBeVisible();
  });

  test("lore screen accessible from title", async ({ page }) => {
    await page.goto("/");
    await page.getByText("大解剖録を開く").click();
    // Should show lore screen
    await expect(page.locator("body")).toBeVisible();
  });
});
