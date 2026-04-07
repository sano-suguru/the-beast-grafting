// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom" />
import { render, screen, fireEvent } from "@testing-library/preact";
import { FreezeButton } from "./freeze-button";
import { phase, shopLocked, currentRunId, shopUnits } from "../state/game-store";
import { makeUnit } from "../../engine/test-helpers";
import { stubFetch, shopRoute, makeShopState, toBoardUnit } from "../state/test-helpers";

beforeEach(() => {
  phase.value = "SHOP";
  shopLocked.value = false;
  currentRunId.value = "test-run-id";
  shopUnits.value = [{ unit: makeUnit(), frozen: false, eventSourced: false }];
  vi.restoreAllMocks();
});

describe("FreezeButton", () => {
  it("shows frozen state when isFrozen is true", () => {
    render(<FreezeButton slotType="unit" index={0} isFrozen />);
    const toggle = screen.getByRole("switch", { name: "防腐処理" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("shows unfrozen state when isFrozen is false", () => {
    render(<FreezeButton slotType="unit" index={0} isFrozen={false} />);
    const toggle = screen.getByRole("switch", { name: "防腐処理" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("freezes unit via real action on click", async () => {
    const unit = makeUnit();
    shopUnits.value = [{ unit, frozen: false, eventSourced: false }];
    stubFetch(
      shopRoute(
        makeShopState({
          shopUnits: [{ unit: toBoardUnit(unit), frozen: true, eventSourced: false }],
        }),
      ),
    );

    render(<FreezeButton slotType="unit" index={0} />);
    fireEvent.click(screen.getByRole("switch", { name: "防腐処理" }));
    await vi.waitFor(() => expect(shopLocked.value).toBe(false));

    expect(shopUnits.value[0]!.frozen).toBe(true);
  });

  it("unfreezes unit via real action on click", async () => {
    const unit = makeUnit();
    shopUnits.value = [{ unit, frozen: true, eventSourced: false }];
    stubFetch(
      shopRoute(
        makeShopState({
          shopUnits: [{ unit: toBoardUnit(unit), frozen: false, eventSourced: false }],
        }),
      ),
    );

    render(<FreezeButton slotType="unit" index={0} isFrozen />);
    fireEvent.click(screen.getByRole("switch", { name: "防腐処理" }));
    await vi.waitFor(() => expect(shopLocked.value).toBe(false));

    expect(shopUnits.value[0]!.frozen).toBe(false);
  });
});
