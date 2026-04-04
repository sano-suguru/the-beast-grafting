import { Droplet } from "lucide-preact";
import { UNIT_COST } from "../../../shared/constants";
import {
  shopUnits,
  shopItems,
  shopRewards,
  activeEvent,
  onboardingStep,
  showHelpOverlay,
} from "../../state/game-store";
import { checkHighlight } from "../../state/card-actions";
import { UnitCard } from "../../components/unit-card";
import { ItemCard } from "../../components/item-card";
import { FreezeButton } from "../../components/freeze-button";
import { OnboardingTooltip } from "../../components/onboarding-tooltip";

function getUnitHighlight(
  type: "SHOP_UNIT" | "REWARD_UNIT",
  index: number,
  item: (typeof shopUnits.value)[number],
): ReturnType<typeof checkHighlight> {
  const hl = checkHighlight(type, index, item?.unit ?? null);
  if (hl) return hl;
  if (type === "SHOP_UNIT" && onboardingStep.value === "buy" && !!item) return "move";
  return false;
}

function ShopUnitList() {
  return (
    <div className="relative min-w-0 flex-1">
      <ul role="list" className="flex min-w-0 flex-1 gap-1 md:gap-2">
        {shopRewards.value.length > 0 && (
          <li
            className="flex min-w-0 shrink-0 gap-1 rounded-md bg-emerald-950/20 p-1 ring-1 ring-emerald-800/40 md:gap-2"
            aria-label="報酬"
          >
            {shopRewards.value.map((item, i) => (
              <div key={`reward-${i}`} className="animate-summon flex min-w-0 flex-1">
                <UnitCard
                  unit={item?.unit ?? null}
                  type="REWARD_UNIT"
                  index={i}
                  isHighlight={getUnitHighlight("REWARD_UNIT", i, item)}
                >
                  {!!item && <FreezeButton slotType="reward" index={i} isFrozen={item.frozen} />}
                </UnitCard>
              </div>
            ))}
          </li>
        )}
        {shopUnits.value.map((item, i) => (
          <li key={`shop-u-${i}`} className="flex min-w-0 flex-1">
            <UnitCard
              unit={item?.unit ?? null}
              type="SHOP_UNIT"
              index={i}
              costOverride={item?.costOverride}
              isFrozen={item?.frozen}
              isHighlight={getUnitHighlight("SHOP_UNIT", i, item)}
            >
              {!!item && <FreezeButton slotType="unit" index={i} isFrozen={item.frozen} />}
            </UnitCard>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ShopItemList() {
  return (
    <ul role="list" className="z-10 flex shrink-0 gap-1 md:gap-2">
      {shopItems.value.map((item, i) => (
        <li key={`shop-i-${i}`} className="relative flex shrink-0">
          <ItemCard item={item?.item ?? null} index={i} isFrozen={item?.frozen} />
          {!!item && (
            <FreezeButton slotType="item" index={i} isFrozen={item.frozen} iconSize={10} />
          )}
        </li>
      ))}
    </ul>
  );
}

export function ShopSection() {
  const event = activeEvent.value;
  const label = event ? event.name : "闇市場";
  const hasRewards = shopRewards.value.length > 0;

  return (
    <section aria-label={label} className="relative z-0 flex min-h-0 flex-1 flex-col pb-4">
      {showHelpOverlay.value && (
        <OnboardingTooltip
          text="素体を買って解剖台に並べろ"
          positionClass="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        />
      )}
      <div className="relative z-10 mb-1 flex items-center gap-3 px-1 md:mb-2">
        <span className="flex items-center gap-1 text-xs font-bold text-zinc-400 md:text-sm">
          {label}
          {!event && (
            <span className="text-[10px] font-normal text-zinc-500">
              (素体・薬 一律 {UNIT_COST}
              <Droplet size={10} className="inline text-red-800" />)
            </span>
          )}
        </span>
        {hasRewards && (
          <span className="animate-summon text-[10px] font-bold tracking-wider text-emerald-500 md:text-xs">
            ▶ 1体選べ
          </span>
        )}
      </div>
      <div className="relative z-0 flex flex-1 items-start gap-2 md:gap-4">
        <ShopUnitList />
        <div className="z-10 mx-0.5 h-24 w-px shrink-0 bg-zinc-800 md:mx-1" aria-hidden="true" />
        <ShopItemList />
      </div>
    </section>
  );
}
