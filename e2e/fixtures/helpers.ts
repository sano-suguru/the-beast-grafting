import type { Page } from "@playwright/test";

export async function startNewGame(page: Page, originName: string) {
  await page.goto("/");
  await page.getByText("地下室へ降りる").click();
  await page.getByText(originName).click();
}

/** Complete onboarding steps so the battle button is enabled.
 *  Thief origin starts with: rat, rat, bat in shop.
 *  Onboarding: buy → graft → roll → battle.
 *
 *  Shop cards contain a freeze button element; board cards don't.
 *  We use this to distinguish them. */
export async function prepareForBattle(page: Page) {
  // Shop unit cards: have a nested <button> (freeze button) inside
  const shopUnitCards = page.locator(
    "[class*='max-w-\\[72px\\]'][class*='bg-zinc-900']:has(button):not([class*='dashed'])",
  );
  // Board cards: no nested button, not dashed (has a unit)
  const boardUnitCards = page.locator(
    "[class*='max-w-\\[72px\\]'][class*='bg-zinc-900']:not(:has(button)):not([class*='dashed'])",
  );
  const emptyBoardSlots = page.locator("[class*='dashed']");

  // Step 1 (buy): Click first shop rat → empty board slot
  await shopUnitCards.first().click();
  await emptyBoardSlots.first().click();

  // Step 2 (graft): Click remaining shop rat → board rat
  // After buying, shop has 1 rat + 1 bat, board has 1 rat
  await shopUnitCards.first().click();
  await boardUnitCards.first().click();

  // Step 3 (roll): Click roll button (should now be enabled)
  await page.getByRole("button", { name: /墓暴き/ }).click();
}
