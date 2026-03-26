import { test, expect } from "@playwright/test";
import { startNewGame } from "./fixtures/helpers";

test.describe("Game Flow", () => {
  test("title screen loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("The Beast Grafter")).toBeVisible();
    await expect(page.getByRole("button", { name: "地下室へ降りる" })).toBeVisible();
  });

  test("navigate from title to origin selection", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "地下室へ降りる" }).click();
    await expect(page.getByRole("heading", { name: "素性の選択" })).toBeVisible();
    await expect(page.getByRole("button", { name: /卑劣なる死体泥棒/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /堕ちた異端審問官/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /狂気の解剖医/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /深淵の邪教徒/ })).toBeVisible();
  });

  test("select origin and enter shop", async ({ page }) => {
    await startNewGame(page, "卑劣なる死体泥棒");
    await expect(page.getByRole("region", { name: "解剖台" })).toBeVisible();
    await expect(page.getByText("疫病ネズミ").first()).toBeVisible();
  });

  test("lore screen accessible from title", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /大解剖録を開く/ }).click();
    await expect(page.getByRole("heading", { name: "大解剖録" })).toBeVisible();
  });
});
