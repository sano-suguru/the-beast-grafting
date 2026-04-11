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
    <div className="scrollbar-hide relative min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto scroll-smooth py-3">
      <ul role="list" className="flex gap-1 md:gap-2">
        {shopRewards.value.length > 0 && (
          <li
            className="bg-tarnished-gold-dim/10 ring-tarnished-gold-dim/40 flex shrink-0 snap-start items-end gap-1 rounded-md p-1 ring-1 md:gap-2"
            aria-label="報酬"
          >
            <span className="animate-summon text-tarnished-gold text-body-xs font-bold tracking-wider [writing-mode:vertical-rl]">
              1体選べ
            </span>
            {shopRewards.value.map((item, i) => (
              <div
                key={`reward-${i}`}
                className="animate-summon flex w-[60px] shrink-0 md:w-[72px]"
              >
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
          <li key={`shop-u-${i}`} className="flex w-[60px] shrink-0 snap-start md:w-[72px]">
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
      <div className="from-void pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l to-transparent" />
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
  return (
    <section aria-label={label} className="relative z-0 flex min-h-0 flex-1 flex-col pb-4">
      {showHelpOverlay.value && (
        <OnboardingTooltip
          text="素体を買って解剖台に並べろ"
          positionClass="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        />
      )}
      <div className="relative z-10 mb-1 flex items-center gap-3 px-1 md:mb-2">
        <span className="text-parchment-dim flex items-center gap-1 text-xs font-bold md:text-sm">
          {label}
          {!event && (
            <span className="text-iron-light text-body-xs font-normal">
              (素体・薬 一律 {UNIT_COST}
              <Droplet size={10} className="text-blood-dim inline" />)
            </span>
          )}
        </span>
      </div>
      <div className="relative z-0 flex flex-1 items-start gap-2 md:gap-4">
        <ShopUnitList />
        <div className="bg-iron z-10 mx-0.5 h-24 w-px shrink-0 md:mx-1" aria-hidden="true" />
        <ShopItemList />
      </div>
    </section>
  );
}
