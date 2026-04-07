import { test, expect } from "@playwright/test";

test.describe("Auth error flow", () => {
  test("navigating with auth_error param opens overlay and shows error banner", async ({
    page,
  }) => {
    await page.goto("/?auth_error=provider_not_configured");

    await expect(page.getByText("この認証プロバイダは現在利用できません。")).toBeVisible();
    await expect(page).toHaveURL("/");
  });

  test("clicking Google login with unconfigured credentials shows error", async ({ page }) => {
    await page.goto("/");

    // Wait for identity badge to appear (async session init)
    const badge = page.getByRole("button", { name: /ゲスト/ });
    await expect(badge).toBeVisible({ timeout: 10_000 });
    await badge.click();

    // Verify overlay opened
    await expect(page.getByText("表示名")).toBeVisible();

    // Click Google login — full page navigation to /api/auth/google → 302 → /?auth_error=...
    await page.getByRole("button", { name: /Googleでログイン/ }).click();

    // Should show error banner after redirect
    await expect(page.getByText("この認証プロバイダは現在利用できません。")).toBeVisible({
      timeout: 15_000,
    });
  });
});
