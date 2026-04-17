import { getSkillText, TEMPLATED_UNIT_IDS, FIXED_SKILL_IDS } from "./skill-text";
import type { UnitId } from "./types";

describe("template coverage", () => {
  // bone_tree: Lv1とLv2のバフ値が同じ({0,1})のためテキストも同一
  // grave_worm: Lv1とLv2のsellBuff値が同じ({0,1})のためテキストも同一
  const LV1_EQUALS_LV2: ReadonlySet<UnitId> = new Set(["bone_tree", "grave_worm"] as UnitId[]);

  for (const id of TEMPLATED_UNIT_IDS) {
    if (FIXED_SKILL_IDS.has(id as Parameters<typeof FIXED_SKILL_IDS.has>[0])) {
      it(`${id}: text is constant across levels`, () => {
        const lv1 = getSkillText(id, 1);
        const lv2 = getSkillText(id, 2);
        expect(lv2).toBe(lv1);
      });
    } else if (LV1_EQUALS_LV2.has(id)) {
      it(`${id}: Lv3 text differs from Lv1`, () => {
        const lv1 = getSkillText(id, 1);
        const lv3 = getSkillText(id, 3);
        expect(lv3).not.toBe(lv1);
      });
    } else {
      it(`${id}: Lv2 text differs from Lv1`, () => {
        const lv1 = getSkillText(id, 1);
        const lv2 = getSkillText(id, 2);
        expect(lv2).not.toBe(lv1);
      });
    }
  }
});
