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
    // This test only works when Google OAuth credentials are NOT configured (CI)
    // Locally, .dev.vars has real credentials, so the redirect goes to Google instead of error
    const isCI =
      "CI" in
      (
        ((globalThis as Record<string, unknown>)["process"] as Record<
          string,
          Record<string, string>
        >) ?? { env: {} }
      ).env;
    test.skip(!isCI, "requires unconfigured Google OAuth (CI only)");
    await page.goto("/");

    // Wait for identity badge to appear (async session init)
    // Guest names are "名もなき術師#XXXX" format
    const badge = page.getByRole("button", { name: /術師/ });
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
