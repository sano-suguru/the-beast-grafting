import type { Page } from "@playwright/test";

export async function startNewGame(page: Page, originName: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "地下室へ降りる" }).click();
  await page.getByRole("button", { name: originName }).click();
}

/** Complete onboarding steps so the battle button is enabled.
 *  Thief origin starts with: rat, rat, bat in shop.
 *  Onboarding: buy → graft → roll → battle.
 *
 *  Cards are <button>, freeze toggles are role="switch".
 *  getByRole("button") cleanly matches only card buttons. */
export async function prepareForBattle(page: Page) {
  const shop = page.getByRole("region", { name: "闇市場" });
  const board = page.getByRole("region", { name: "解剖台" });

  const shopUnits = shop.getByRole("list").first();
  const emptyBoardSlots = board.getByRole("button", { name: "空きスロット" });

  // Step 1 (buy): Click first shop unit → empty board slot
  await shopUnits.getByRole("button", { name: "疫病ネズミ" }).first().click();
  await emptyBoardSlots.first().click();

  // Step 2 (graft): Click remaining shop rat → board rat
  await shopUnits.getByRole("button", { name: "疫病ネズミ" }).click();
  await board.getByRole("button", { name: "疫病ネズミ" }).click();

  // Step 3 (roll): Click roll button
  await page.getByRole("button", { name: /墓暴き/ }).click();
}
