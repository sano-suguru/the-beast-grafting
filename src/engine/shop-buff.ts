import type { Buff } from "../shared/skill-params";

interface BuffableUnit {
  buffAtk: number;
  buffHp: number;
}

interface ShopSlotLike<TUnit extends BuffableUnit> {
  unit: TUnit;
}

export function applyShopBuffToUnit<TUnit extends BuffableUnit>(unit: TUnit, buff: Buff): TUnit {
  if (buff.atk === 0 && buff.hp === 0) return unit;
  return {
    ...unit,
    buffAtk: unit.buffAtk + buff.atk,
    buffHp: unit.buffHp + buff.hp,
  };
}

export function applyShopBuffToSlots<TSlot extends ShopSlotLike<BuffableUnit>>(
  slots: (TSlot | null)[],
  buff: Buff,
): (TSlot | null)[] {
  if (buff.atk === 0 && buff.hp === 0) return slots;
  return slots.map((slot) =>
    slot
      ? {
          ...slot,
          unit: applyShopBuffToUnit(slot.unit, buff),
        }
      : null,
  );
}

export function replaceUnitKeepingShopBuff<
  TPreviousUnit extends BuffableUnit,
  TNextUnit extends BuffableUnit,
>(previousUnit: TPreviousUnit, nextUnit: TNextUnit): TNextUnit {
  return {
    ...nextUnit,
    buffAtk: previousUnit.buffAtk,
    buffHp: previousUnit.buffHp,
  };
}
